export function FAQ() {
  return (
    <section className="mb-20">
      <div className="text-center mb-10">
        <h3 className="font-serif text-3xl text-gray-900 dark:text-white mb-2">Frequently Asked Questions</h3>
        <div className="h-1 w-16 bg-primary mx-auto"></div>
      </div>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white dark:bg-surface-dark p-6 rounded-lg shadow-sm border border-border-light dark:border-border-dark">
          <h4 className="font-bold text-gray-900 dark:text-white mb-2">Who can use this system?</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Access is restricted to UWI students and staff with valid university email domains.
          </p>
        </div>
        <div className="bg-white dark:bg-surface-dark p-6 rounded-lg shadow-sm border border-border-light dark:border-border-dark">
          <h4 className="font-bold text-gray-900 dark:text-white mb-2">What if a room is full?</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            You can join a digital waitlist; if a slot opens, you will receive an email offer that must be accepted within 15 minutes.
          </p>
        </div>
        <div className="bg-white dark:bg-surface-dark p-6 rounded-lg shadow-sm border border-border-light dark:border-border-dark">
          <h4 className="font-bold text-gray-900 dark:text-white mb-2">Can staff book for me?</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Yes, if student self-booking is disabled, library staff can create bookings on your behalf using your Student ID.
          </p>
        </div>
      </div>
    </section>
  );
}
