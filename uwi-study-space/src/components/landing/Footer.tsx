import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-gray-100 dark:bg-surface-dark border-t border-gray-200 dark:border-gray-700 mt-auto py-12 text-sm">
      <div className="max-w-[960px] mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <h6 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Address</h6>
          <address className="not-italic text-gray-600 dark:text-gray-400 text-xs leading-relaxed">
            The University of the West Indies<br />
            St. Augustine, Trinidad and Tobago<br />
            <Link className="text-primary dark:text-blue-300 underline mt-2 block" href="/directions">Get Directions</Link>
          </address>
        </div>
        <div>
          <h6 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Library Hours</h6>
          <ul className="text-gray-600 dark:text-gray-400 text-xs space-y-1">
            <li className="flex justify-between"><span>Mon - Fri:</span> <span>8:30am – 7:00pm</span></li>
            <li className="flex justify-between"><span>Sat:</span> <span>8:30am – 5:00pm</span></li>
            <li className="flex justify-between"><span>Sun:</span> <span>Closed</span></li>
          </ul>
        </div>
        <div>
          <h6 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Contact Us</h6>
          <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">(868) 662-2002</p>
          <a className="text-primary dark:text-blue-300 text-xs underline" href="mailto:almajordanlibrary@sta.uwi.edu">almajordanlibrary@sta.uwi.edu</a>
          
        </div>
        <div>
          <h6 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Login</h6>
          <form className="space-y-2">
            <input className="w-full text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800" placeholder="Username" type="text" />
            <input className="w-full text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800" placeholder="Password" type="password" />
            <button className="w-full bg-black dark:bg-gray-700 text-white text-xs font-bold uppercase py-2 hover:bg-primary transition-colors">Login</button>
            <Link className="text-[10px] text-gray-500 hover:underline block text-center" href="/forgot-password">Forgot your password?</Link>
          </form>
          
        </div>
      </div>
      <div className="max-w-[960px] mx-auto px-4 mt-10 pt-4 border-t border-gray-200 dark:border-gray-700 text-center md:text-left flex flex-col md:flex-row justify-between items-center text-[10px] text-gray-400">
        <p>© {new Date().getFullYear()} The University of the West Indies, St. Augustine Campus. All rights reserved.</p>
    
      </div>
    </footer>
  );
}
