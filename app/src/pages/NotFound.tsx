import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import Layout from '@/components/Layout';
import { useSeo } from '@/lib/seo';

const NotFound: React.FC = () => {
  useSeo({
    title: "Page not found",
    description: "This page isn't part of Baraza. Head back to browse communities.",
    noIndex: true,
  });
  return (
    <Layout>
      <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden py-20">
        <div className="relative z-10 mx-auto max-w-xl px-4 text-center">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest">
            404
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold md:text-4xl">
            This page isn&apos;t part of Baraza.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed">
            The page you&apos;re looking for may have moved or never existed.
            Head back to explore communities or launch your own.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/" className="btn-warm inline-flex items-center gap-2 text-sm">
              <Home className="h-4 w-4" />
              Go Home
            </Link>
            <Link
              to="/communities"
              className="btn-ghost inline-flex items-center gap-2 text-sm"
            >
              <Compass className="h-4 w-4" />
              Browse communities
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default NotFound;
