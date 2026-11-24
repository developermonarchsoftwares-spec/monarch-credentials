import type { ReactNode } from "react";

const Page = ({ title, children }: { title: string; children: ReactNode }) => (
  <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
    <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
    <div className="mt-8 space-y-5 text-[15px] leading-relaxed text-ink/85 [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">{children}</div>
  </article>
);

export const Privacy = () => (
  <Page title="Privacy notice">
    <p>This notice explains what this site shows and records when you verify a credential. It is a plain-language summary and should be reviewed by the issuing organisations' legal advisers before being relied on.</p>
    <h2>What is shown publicly</h2>
    <p>For a published credential: the learner's name, the credential title and programme, the issuing organisation, relevant dates, the credential ID and its status. Email addresses, phone numbers, addresses and internal records are never shown.</p>
    <h2>What we record when you verify</h2>
    <ul>
      <li>The credential ID you looked up and the result (valid, revoked or not found).</li>
      <li>A one-way hash of your IP address, used for rate limiting and abuse prevention. We do not store the address itself.</li>
    </ul>
    <h2>Cookies</h2>
    <p>Public pages set no cookies. Administrators receive a strictly necessary session cookie after signing in.</p>
    <h2>Requests</h2>
    <p>If you are a learner and want a credential corrected or removed, contact the issuing organisation using the details on its page.</p>
  </Page>
);

export const Terms = () => (
  <Page title="Terms of use">
    <p>These terms are a plain-language summary and should be reviewed by the issuing organisations' legal advisers before being relied on.</p>
    <h2>Purpose</h2>
    <p>This site lets people confirm that a credential was issued by Monarch Placements or Monarch Softwares and see whether it is currently valid.</p>
    <h2>What a credential means</h2>
    <p>A Monarch credential attests completion of a programme or internship run by the issuing organisation. It is not a university degree and does not imply accreditation or recognition by any government body or external authority.</p>
    <h2>Acceptable use</h2>
    <ul>
      <li>Do not attempt to guess or enumerate credential IDs. Lookups are rate limited.</li>
      <li>Do not alter, forge or misrepresent a credential.</li>
      <li>Do not scrape the site or interfere with its operation.</li>
    </ul>
    <h2>Accuracy</h2>
    <p>The live record on this site is authoritative. A PDF or screenshot that disagrees with the record should not be relied upon.</p>
  </Page>
);
