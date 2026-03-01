import Link from 'next/link';
import Image from 'next/image';

export function Header() {
  return (
    <header className="bg-white border-b border-gray-200 py-2 md:py-4 flex items-center">
      <div className="max-w-[960px] mx-auto px-6 md:px-8 w-full flex items-center">
        <Link href="/" className="flex items-center hover:opacity-90 transition-opacity">
          <div className="relative h-[60px] w-[300px] md:h-[80px] md:w-[400px] flex-shrink-0">
            <Image 
              src="/assets/almajordanHeader.jpg"
              alt="The University of the West Indies - The Alma Jordan Library" 
              fill 
              className="object-contain object-left pb-2"
              priority
            />
          </div>
        </Link>
      </div>
    </header>
  );
}
