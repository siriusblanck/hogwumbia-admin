/* Live integration checks. Creates two explicitly disposable fixture accounts and
 * one media fixture, then removes all of them in finally. No real member is edited. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anonKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin=createClient(url,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const anon=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
const fixtures=[], mediaId=randomUUID();let imagePath;
const ok=(r,label)=>{assert.equal(r.error,null,`${label}: ${r.error?.message}`);return r.data};
try {
 const password=randomUUID()+randomUUID();
 for(let n=0;n<2;n++) {
  const email=`admin-check-${randomUUID()}@example.com`;
  const {user}=ok(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{is_superadmin:true}}),'create fixture');
  fixtures.push({id:user.id,email});
 }
 const jar=new Map();
 const member=createServerClient(url,anonKey,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:cs=>cs.forEach(c=>jar.set(c.name,c.value))}});
 ok(await member.auth.signInWithPassword({email:fixtures[0].email,password}),'sign in fixture');
 const profile=ok(await member.from('profiles').select('is_superadmin').eq('id',fixtures[0].id).single(),'read own flag');
 assert.equal(profile.is_superadmin,false,'signup metadata must not confer admin');
 assert((await member.from('profiles').update({is_superadmin:true}).eq('id',fixtures[0].id)).error,'member cannot self-promote');
 assert((await anon.from('profiles').select('id')).error,'anonymous cannot read profiles');
 assert.deepEqual(ok(await member.from('profiles').select('id').eq('id',fixtures[1].id),'other profile'),[]);
 console.log('PASS default-deny privileges, signup metadata attack, self-promotion denial, private profiles');
 const origin=process.env.TEST_APP_URL || 'http://127.0.0.1:3001';
 assert(['127.0.0.1','localhost'].includes(new URL(origin).hostname),'Run HTTP checks against local app only');
 for(const path of ['/','/profiles','/media','/media/new',`/media/${mediaId}`,'/votes']) {
  for(const authenticated of [false,true]) {
   const response=await fetch(origin+path,{redirect:'manual',headers:authenticated?{cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}:{}});
   assert.equal(response.status,307,`${path} must redirect`);
   assert(response.headers.get('location').startsWith('/login'),`${path} must require login/role`);
  }
 }
 ok(await admin.from('profiles').update({is_superadmin:true}).eq('id',fixtures[0].id),'set non-Google fixture flag');
 const denied=await fetch(origin+'/profiles',{redirect:'manual',headers:{cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}});
 assert.equal(denied.headers.get('location'),'/login?reason=restricted','non-Google admin must be denied');
 console.log('PASS all six admin routes deny anonymous/member access; non-Google superadmin denied');
 const writer=ok(await admin.from('characters').select('id').eq('is_active',true).limit(1).single(),'writer');
 const topic=ok(await admin.from('owl_posts').select('id').limit(1).single(),'topic');
 imagePath=`${fixtures[0].id}/${mediaId}.png`;
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=','base64');
 ok(await admin.storage.from('generations').upload(imagePath,png,{contentType:'image/png'}),'fixture image');
 ok(await admin.from('generations').insert({id:mediaId,author_id:fixtures[0].id,author_display:'Integration fixture',house:'ravenclaw',character_id:writer.id,owl_post_id:topic.id,owl_post_date:'2000-01-03',caption:'Disposable integration fixture',image_path:imagePath,image_alt:'A test pixel',caption_prompt:'test',image_prompt:'test',caption_model:'test',image_model:'test'}),'create media');
 assert((await member.from('generations').update({caption:'unauthorized'}).eq('id',mediaId)).error,'ordinary user cannot edit media');
 ok(await admin.from('generations').update({caption:'Updated disposable fixture'}).eq('id',mediaId),'update media');
 assert.equal(ok(await admin.from('generations').select('caption').eq('id',mediaId).single(),'read media').caption,'Updated disposable fixture');
 ok(await admin.from('votes').insert({generation_id:mediaId,voter_id:fixtures[1].id,value:1}),'fixture vote');
 assert.equal(ok(await admin.from('generations').select('score').eq('id',mediaId).single(),'score').score,1);
 ok(await admin.from('generations').delete().eq('id',mediaId),'delete fixture');
 assert.equal(ok(await admin.from('votes').select('generation_id').eq('generation_id',mediaId),'cascade').length,0);
 console.log('PASS media create/read/update/delete, normal-member write denial, score trigger and vote cascade');
} finally {
 await admin.from('generations').delete().eq('id',mediaId);
 if(imagePath) ok(await admin.storage.from('generations').remove([imagePath]),'cleanup image');
 for(const fixture of fixtures) ok(await admin.auth.admin.deleteUser(fixture.id),'cleanup account');
 console.log('Cleaned up disposable fixture data.');
}
