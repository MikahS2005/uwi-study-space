import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { Sidebar } from "@/components/landing/Sidebar";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { BookingOptions } from "@/components/landing/BookingOptions";
import { RulesPreview } from "@/components/landing/RulesPreview";
import { About } from "@/components/landing/About";
import { FAQ } from "@/components/landing/FAQ";
import { Footer } from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <div className="bg-background-light text-text-light font-sans antialiased min-h-screen flex flex-col">
      <Header />
      <Hero />

      <div className="max-w-[960px] mx-auto w-full flex-grow flex flex-col md:flex-row py-8 relative px-4">
        <Sidebar />

        <main className="w-full md:w-[750px] pl-0 md:pl-8 flex-grow">
          <HowItWorks />
          <BookingOptions />
          <RulesPreview />
          <About />
          <FAQ />
        </main>
      </div>

      <Footer />
    </div>
  );
}
