"use client";
export default function ErrorPage({reset}:{reset:()=>void}) { return <main className="error-page"><h1>The owl took a wrong turn.</h1><p>We couldn’t load this page. No changes have been confirmed.</p><button className="button primary" onClick={reset}>Try again</button></main>; }
