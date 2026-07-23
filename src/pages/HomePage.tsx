import { useEffect } from 'react';
import Hero from '../components/Hero';
import Product from '../components/Product';
import Models from '../components/Models';
import Benchmarks from '../components/Benchmarks';
import Safety from '../components/Safety';
import Company from '../components/Company';
import CTA from '../components/CTA';
import { setPageMeta } from '../lib/seo';

export default function HomePage() {
  useEffect(() => {
    setPageMeta({ path: '/' });
  }, []);

  return (
    <main>
      <Hero />
      <Product />
      <Models />
      <Benchmarks />
      <Safety />
      <Company />
      <CTA />
    </main>
  );
}
