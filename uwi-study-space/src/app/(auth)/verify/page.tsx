export default function VerifyPage() {
  return (
    <div className="rounded-lg border p-6">
      <h1 className="text-xl font-semibold">Check your email</h1>
      <p className="mt-2 text-sm text-gray-700">
        A verification link was sent. Click it to confirm your account, then come back and log in.
      </p>
      <p className="mt-4 text-sm text-gray-700">
        <a className="underline" href="/login">
          Back to login
        </a>
      </p>
    </div>
  );
}
