import Link from 'next/link';
import Image from 'next/image';

export function BookingOptions() {
  return (
    <section className="mb-16 bg-surface-light dark:bg-surface-dark relative p-0 rounded-lg overflow-hidden border border-border-light dark:border-border-dark">
      <div className="flex flex-col md:flex-row">
        <div className="p-8 md:w-1/2 bg-gray-900 text-white dark:bg-black/60 z-10 relative">
          <h3 className="font-serif text-2xl mb-2 text-white">Group Study Rooms</h3>
          <p className="text-gray-400 text-xs mb-8">Collaborate with your peers in dedicated group study spaces across different faculties.</p>
          <div className="space-y-6">
            <div className="border-l-2 border-primary pl-4 hover:bg-white/5 p-2 transition-colors cursor-pointer">
              <h4 className="font-bold text-sm mb-1 text-primary-soft">1st Floor: Engineering</h4>
              <p className="text-xs text-gray-400">Equipped with whiteboards and screens. Rooms available for groups of 2 to 6 people.</p>
            </div>
            <div className="border-l-2 border-gray-700 hover:border-primary pl-4 hover:bg-white/5 p-2 transition-colors cursor-pointer">
              <h4 className="font-bold text-sm mb-1 text-white">2nd Floor: Humanities</h4>
              <p className="text-xs text-gray-400">Quiet collaboration spaces. Rooms available for groups of 2 to 4 people.</p>
            </div>
            <div className="border-l-2 border-gray-700 hover:border-primary pl-4 hover:bg-white/5 p-2 transition-colors cursor-pointer">
              <h4 className="font-bold text-sm mb-1 text-white">4th Floor: Law</h4>
              <p className="text-xs text-gray-400">Formal discussion rooms. Rooms available for groups of 4 to 6 people.</p>
            </div>
          </div>
          <div className="mt-8 text-right">
            <Link className="inline-block bg-white text-gray-900 text-[10px] font-bold uppercase tracking-widest py-2 px-4 hover:bg-gray-200 transition-colors" href="/rooms">Browse All Rooms</Link>
          </div>
        </div>
        <div className="md:w-1/2 relative min-h-[300px]">
          <Image
            alt="Library Study Rooms"
            className="absolute inset-0 w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
            src="/assets/books.png"
            fill
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </section>
  );
}
