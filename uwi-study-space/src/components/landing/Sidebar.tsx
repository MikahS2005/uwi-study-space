import Link from 'next/link';

export function Sidebar() {
  return (
    <aside className="w-full md:w-[210px] flex-shrink-0 pr-6 border-r border-border-light dark:border-border-dark md:min-h-[600px] mb-8 md:mb-0">
      <div className="sticky top-4">
        <h3 className="font-serif text-lg text-primary dark:text-blue-300 border-b-2 border-primary mb-4 pb-2">Quick Links</h3>
        <nav className="flex flex-col space-y-3 text-sm font-serif">
          <Link className="block text-gray-700 dark:text-gray-300 hover:text-primary dark:hover:text-blue-300 transition-colors group flex items-center" href="https://al23app.sta.uwi.edu/F/">
            <span className="material-symbols-outlined text-base mr-2 text-gray-400 group-hover:text-primary">book</span> Catalog Search
          </Link>
          
          <Link className="block text-gray-700 dark:text-gray-300 hover:text-primary dark:hover:text-blue-300 transition-colors group flex items-center" href="https://libraries.sta.uwi.edu/apps/index.php/DatabaseSearch/index">
            <span className="material-symbols-outlined text-base mr-2 text-gray-400 group-hover:text-primary">computer</span> Research Databases
          </Link>
          <Link className="block text-gray-700 dark:text-gray-300 hover:text-primary dark:hover:text-blue-300 transition-colors group flex items-center" href="https://uwi-sta.libanswers.com/">
            <span className="material-symbols-outlined text-base mr-2 text-gray-400 group-hover:text-primary">people</span> Ask a Librarian
          </Link>
          <Link className="block text-gray-700 dark:text-gray-300 hover:text-primary dark:hover:text-blue-300 transition-colors group flex items-center" href="/events">
            <span className="material-symbols-outlined text-base mr-2 text-gray-400 group-hover:text-primary">quiz</span> Past Papaer
          </Link>
          <Link className="block text-gray-700 dark:text-gray-300 hover:text-primary dark:hover:text-blue-300 transition-colors group flex items-center" href="https://libraries.sta.uwi.edu/ajl/index.php/about-the-library/opening-hours">
            <span className="material-symbols-outlined text-base mr-2 text-gray-400 group-hover:text-primary">schedule</span> Opening Hours
          </Link>
          <Link className="block text-gray-700 dark:text-gray-300 hover:text-primary dark:hover:text-blue-300 transition-colors group flex items-center" href="/rooms">
            <span className="material-symbols-outlined text-base mr-2 text-gray-400 group-hover:text-primary">meeting_room</span> Book a Room
          </Link>
        </nav>
        <div className="mt-10 bg-surface-light dark:bg-surface-dark p-4 rounded border border-border-light dark:border-border-dark">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500 mb-3">Library Hours</h4>
          <div className="space-y-3">
            <div>
              <div className="text-xs font-bold text-gray-500 mb-1">Mon - Fri</div>
              <div className="flex items-center text-primary dark:text-blue-300">
                <span className="material-symbols-outlined mr-2 text-sm">schedule</span>
                <span className="font-serif text-sm font-bold">8:30 am - 7:00 pm</span>
              </div>
            </div>
            <div className="border-t border-border-light dark:border-border-dark pt-3">
              <div className="text-xs font-bold text-gray-500 mb-1">Sat</div>
              <div className="flex items-center text-primary dark:text-blue-300">
                <span className="material-symbols-outlined mr-2 text-sm">schedule</span>
                <span className="font-serif text-sm font-bold">8:30 am - 5:00 pm</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
