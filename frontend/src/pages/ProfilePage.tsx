// ProfilePage: the company profile screen (FR-02). It is only a frame;
// the two parts do the work:
//   ProfileForm    the firm's details
//   PastContracts  the table of past contracts
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import PageHeader from "../components/PageHeader";
import PastContracts from "../components/PastContracts";
import ProfileForm from "../components/ProfileForm";

export default function ProfilePage() {
  const { hash } = useLocation();

  // The dashboard links to /profile#contracts. The browser cannot jump to
  // that part by itself, because it is drawn after the page loads, so wait
  // a moment and scroll to it.
  useEffect(() => {
    if (!hash) return;
    const timer = setTimeout(() => {
      document.querySelector(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
    return () => clearTimeout(timer);
  }, [hash]);

  return (
    <>
      <PageHeader
        title="Company profile"
        description="Every tender is checked against these details. Keep them complete and up to date."
      />
      <div className="space-y-6">
        <ProfileForm />
        <div id="contracts" className="scroll-mt-20">
          <PastContracts />
        </div>
      </div>
    </>
  );
}
