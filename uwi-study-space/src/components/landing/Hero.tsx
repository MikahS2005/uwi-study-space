import Image from 'next/image';
import Link from 'next/link';

export function Hero() {
  return (
    <div className="bg-primary-soft relative overflow-hidden min-h-[400px] flex items-center">
      <div className="absolute inset-0 z-0 flex justify-end">
        <div className="relative w-full max-w-[1000px] h-full">
          <Image
            alt="The Alma Jordan Library at dusk"
            className="w-full h-full object-cover object-right"
            src="/assets/almjhero2.png"
            fill
            priority
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary-soft via-primary-soft/90 to-primary-soft/30 md:to-transparent"></div>
        </div>
      </div>

      <div className="max-w-[960px] mx-auto w-full px-4 relative z-10 flex flex-col justify-center py-12 md:py-16">
        <div className="max-w-md">
          <h2 className="font-serif text-3xl md:text-4xl text-primary mb-4 leading-tight">
            Master Your <br className="hidden md:block" />
            <span className="italic text-gray-800">Study Sessions.</span>
          </h2>
          <p className="text-sm md:text-base text-gray-700 mb-8 font-serif italic max-w-sm md:max-w-md">
            The official Alma Jordan Library Study Room Booking System for UWI St. Augustine students and staff.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/login"
              className="inline-block text-center bg-primary text-white text-xs md:text-sm font-bold uppercase tracking-wider py-3 px-6 shadow-md hover:bg-primary-dark transition-colors"
            >
              Get Started
            </Link>
            <Link
              href="/login"
              className="inline-block text-center bg-white text-primary text-xs md:text-sm font-bold uppercase tracking-wider py-3 px-6 shadow-md hover:bg-gray-50 transition-colors"
            >
              Staff Portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
