export function RulesPreview() {
  return (
    <section className="mb-16 bg-surface-light dark:bg-surface-dark relative p-8 rounded-lg overflow-hidden border border-border-light dark:border-border-dark">
      <h3 className="font-serif text-2xl mb-6 text-gray-900 dark:text-white">Booking Rules & Limits</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex gap-4">
          <span className="material-symbols-outlined text-primary mt-1">schedule</span>
          <div>
            <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-1">Flexible Scheduling</h4>
            <p className="text-xs text-gray-600 dark:text-gray-400">Book slots in 90 minutes increments for up to 3 consecutive hours.</p>
          </div>
        </div>
        <div className="flex gap-4">
          <span className="material-symbols-outlined text-primary mt-1">calendar_month</span>
          <div>
            <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-1">Plan Ahead</h4>
            <p className="text-xs text-gray-600 dark:text-gray-400">Reserve your preferred space up to 7 days in advance.</p>
          </div>
        </div>
        <div className="flex gap-4">
          <span className="material-symbols-outlined text-primary mt-1">rule</span>
          <div>
            <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-1">Daily Limits</h4>
            <p className="text-xs text-gray-600 dark:text-gray-400">Students can manage up to 2 room bookings per day to ensure fair access for all.</p>
          </div>
        </div>
        <div className="flex gap-4">
          <span className="material-symbols-outlined text-primary mt-1">group</span>
          <div>
            <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-1">Fair Access Policy</h4>
            <p className="text-xs text-gray-600 dark:text-gray-400">A smart waitlist system manages high-demand periods and repeated bookings.</p>
          </div>
        </div>
        <div className="flex gap-4">
          <span className="material-symbols-outlined text-primary mt-1">block</span>
          <div>
            <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-1">No-Show Policy</h4>
            <p className="text-xs text-gray-600 dark:text-gray-400">The next person on the waitlist is assigned the room if the original booker is more than 15 minutes late.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
