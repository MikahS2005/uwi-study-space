import Image from 'next/image';

export function About() {
  return (
    <section className="mb-16 flex flex-col md:flex-row items-stretch border border-border-light dark:border-border-dark rounded-lg overflow-hidden">
      <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-white dark:bg-surface-dark">
        <h3 className="font-serif text-3xl md:text-4xl text-gray-900 dark:text-white mb-4">Engineered for Excellence.</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 font-serif leading-relaxed mb-4">
          This platform was developed by students of the Department of Electrical and Computer Engineering at The University of the West Indies, St. Augustine Campus.
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300 font-serif leading-relaxed">
          <strong>Mission:</strong> To provide library personnel with total control over room availability and departmental management while streamlining the student experience.
        </p>
      </div>
      <div className="md:w-1/2 relative min-h-[300px]">
        <Image
          src="/assets/circuit_scope.png"
          alt="Circuit Scope"
          fill
          className="object-cover"
        />
      </div>
    </section>
  );
}