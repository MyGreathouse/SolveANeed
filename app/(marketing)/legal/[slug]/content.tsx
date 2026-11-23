import type { ReactNode } from "react";

export const LEGAL_PAGES: Record<string, { title: string; body: ReactNode }> = {
  terms: {
    title: "Terms of Use",
    body: (
      <>
        <h2>1. About SolveANeed</h2>
        <p>SolveANeed (solveaneed.com) is an online marketplace that connects people with genuine needs (&quot;requesters&quot;) with people and organisations willing to help (&quot;supporters&quot;). The operator&apos;s full legal entity name, registered address and company number will be inserted here before launch.</p>
        <h2>2. Eligibility</h2>
        <p>You must be 18 or over and able to enter a binding contract. At launch the service is offered in the United Kingdom.</p>
        <h2>3. Your account</h2>
        <ul><li>Provide accurate information and keep your login details secure.</li><li>One person may hold one account, which can be used both to request and to offer help.</li><li>We may suspend accounts that breach these terms or our Acceptable Use Policy.</li></ul>
        <h2>4. Needs and moderation</h2>
        <p>Needs must be genuine, lawful and accurately described. Every need is reviewed before publication. Publication is not a guarantee that a need is genuine; supporters should use their own judgement and report concerns.</p>
        <h2>5. Forms of support</h2>
        <p>Gifts are unconditional. Paid tasks, milestone sponsorship and direct support are governed by the written, versioned agreement accepted by both parties within SolveANeed. Payments are not yet available on the platform.</p>
        <h2>6. Fees</h2>
        <p>Any fees will be shown clearly before you commit. No hidden charges will be applied.</p>
        <h2>7. Complaints and disputes</h2>
        <p>Our complaints and dispute process, including how to appeal a moderation decision, will be published here before launch.</p>
      </>
    ),
  },
  privacy: {
    title: "Privacy Notice",
    body: (
      <>
        <h2>Who we are</h2>
        <p>The data controller&apos;s legal name, address, ICO registration number and contact details will be inserted here before launch.</p>
        <h2>What we collect</h2>
        <ul>
          <li>Account data: email address, display name, sign-up date, 18+ confirmation and role choices.</li>
          <li>Profile data you choose to add: bio, general region, preferred currency.</li>
          <li>Need data: description, amounts, category, general location and any private supporting evidence you upload.</li>
          <li>Safety data: reports, moderation decisions, audit logs and security events.</li>
        </ul>
        <h2>Why we use it (lawful bases)</h2>
        <p>To provide the service (contract), to keep the platform safe and prevent fraud (legitimate interests and legal obligation), and to send optional updates (consent, which you can withdraw in Settings).</p>
        <h2>Who can see it</h2>
        <p>Published needs and your display name (unless you hide it) are visible to visitors. Supporting evidence is private to you and our moderators. We never sell personal data.</p>
        <h2>Retention</h2>
        <p>Retention periods for each category of data will be listed here. When you request deletion we anonymise your profile immediately and remove remaining data after any legally required retention period.</p>
        <h2>Your rights</h2>
        <p>You can access, correct, export or delete your data, object to processing and complain to the Information Commissioner&apos;s Office (ico.org.uk).</p>
      </>
    ),
  },
  cookies: {
    title: "Cookie Notice",
    body: (
      <>
        <p>SolveANeed currently uses only strictly necessary cookies, which keep you signed in securely. We do not use advertising or analytics cookies. If that changes, we will ask for your consent first.</p>
        <h2>Strictly necessary cookies</h2>
        <ul><li><strong>Supabase authentication cookies</strong> (sb-*): keep you signed in and protect your session.</li></ul>
      </>
    ),
  },
  "acceptable-use": {
    title: "Acceptable Use Policy",
    body: (
      <>
        <p>To keep SolveANeed safe, you must not use it to:</p>
        <ul>
          <li>Post false, misleading or duplicate needs, or exaggerate urgency.</li>
          <li>Request or offer illegal, deceptive or unsafe services, or sexual services of any kind.</li>
          <li>Coerce, harass, exploit or make unreasonable personal demands of anyone.</li>
          <li>Ask anyone to move payments or conversations off-platform to avoid safeguards.</li>
          <li>Share another person&apos;s private information without permission.</li>
          <li>Attempt to access data or features you are not authorised to use.</li>
        </ul>
        <p>Report concerns using the &quot;Report&quot; button on any need. Breaches may lead to removal of content or suspension.</p>
      </>
    ),
  },
};
