import type { PublicCertificate } from "@shared/types";

/** LinkedIn "Add to profile" prefill link. This is a convenience link only: LinkedIn does not verify the credential. */
export const linkedInAddUrl = (c: PublicCertificate): string => {
  const d = c.issueDate ? new Date(`${c.issueDate}T00:00:00Z`) : new Date();
  const p = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: c.title,
    organizationName: c.issuerName,
    issueYear: String(d.getUTCFullYear()),
    issueMonth: String(d.getUTCMonth() + 1),
    certUrl: c.verifyUrl,
    certId: c.certificateId,
  });
  return `https://www.linkedin.com/profile/add?${p.toString()}`;
};

export const linkedInShareUrl = (c: PublicCertificate): string =>
  `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(c.verifyUrl)}`;
