// ProfilePage: the company profile screen (FR-02). It is only a frame;
// the two parts do the work:
//   ProfileForm    the firm's details
//   PastContracts  the table of past contracts
import PastContracts from "../components/PastContracts";
import ProfileForm from "../components/ProfileForm";

export default function ProfilePage() {
  return (
    <main className="mx-auto max-w-4xl space-y-10 px-4 py-8">
      <section>
        <h1 className="text-2xl font-semibold text-slate-900">Company profile</h1>
        <p className="mt-1 text-slate-600">
          These details are compared with each tender's conditions.
        </p>
        <div className="mt-6">
          <ProfileForm />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Past contracts</h2>
        <div className="mt-4">
          <PastContracts />
        </div>
      </section>
    </main>
  );
}
