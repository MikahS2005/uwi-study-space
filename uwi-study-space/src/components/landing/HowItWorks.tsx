export function HowItWorks() {
  return (
    <section className="mb-16">
      <div className="text-center mb-10">
        <h3 className="font-serif text-3xl text-gray-900 dark:text-white mb-2">How It Works</h3>
        <p className="text-xs text-gray-500 max-w-md mx-auto mb-4">Book your study space in three simple steps.</p>
        <div className="h-1 w-16 bg-primary mx-auto"></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white dark:bg-surface-dark p-6 rounded-lg shadow-sm border border-border-light dark:border-border-dark text-center">
          <div className="w-12 h-12 bg-primary-soft dark:bg-blue-900/30 text-primary dark:text-blue-300 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined">login</span>
          </div>
          <h4 className="font-bold text-gray-900 dark:text-white mb-2">Step 1: Authenticate</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Sign in securely using your @my.uwi.edu or @uwi.edu credentials to access your personalized dashboard.
          </p>
        </div>
        <div className="bg-white dark:bg-surface-dark p-6 rounded-lg shadow-sm border border-border-light dark:border-border-dark text-center">
          <div className="w-12 h-12 bg-primary-soft dark:bg-blue-900/30 text-primary dark:text-blue-300 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined">search</span>
          </div>
          <h4 className="font-bold text-gray-900 dark:text-white mb-2">Step 2: Discover & Filter</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Browse available study rooms by department, floor, capacity, and specific amenities.
          </p>
        </div>
        <div className="bg-white dark:bg-surface-dark p-6 rounded-lg shadow-sm border border-border-light dark:border-border-dark text-center">
          <div className="w-12 h-12 bg-primary-soft dark:bg-blue-900/30 text-primary dark:text-blue-300 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined">event_available</span>
          </div>
          <h4 className="font-bold text-gray-900 dark:text-white mb-2">Step 3: Secure Your Slot</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Select your time, state your purpose, and receive an instant email confirmation for your booking.
          </p>
        </div>
      </div>
    </section>
  );
}
