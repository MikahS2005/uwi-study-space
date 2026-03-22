export default function VerifyPage() {
  return (
    <div className="rounded-lg border p-6">
      <h1 className="text-xl font-semibold">Check your email</h1>
      <p className="mt-2 text-sm text-gray-700">
        A verification link was sent to your UWI email. Click it to confirm your account.
      </p>
      <p className="mt-2 text-sm text-gray-700">
        After verification, you will be redirected back into the app to finish setting up your profile.
      </p>
      <p className="mt-4 text-sm text-gray-700">
        <a className="underline" href="/login">
          Back to login
        </a>
      </p>
    </div>
  );
}