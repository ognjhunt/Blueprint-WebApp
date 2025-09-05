import React from "react";
import { Link } from "wouter";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

type Post = {
  title: string;
  description: string;
  href: string;
};

export default function Blog() {
  const posts: Post[] = [
    {
      title: "retailOS – our second phase",
      description:
        "How Blueprint uses AR + AI to elevate in-store ops and customer experience in retail.",
      href: "/blog/retail-os",
    },
    {
      title: "warehouseOS – our first vertical",
      description:
        "How Blueprint brings AR and AI to warehouses for faster, safer operations.",
      href: "/blog/warehouse-os",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#0B1220] text-slate-100">
      {/* BACKGROUND: subtle dot grid + emerald→cyan wash */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            background:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.18) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.10] via-cyan-500/[0.08] to-transparent mix-blend-screen" />
      </div>

      <Nav />

      <main className="flex-1 pt-24 px-4 md:px-8">
        <section className="max-w-6xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-extrabold text-center mb-10 bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
            Blueprint Blog
          </h1>

          <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link
                key={post.href}
                href={post.href}
                className="group block focus:outline-none"
              >
                <Card className="h-full rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-sm shadow-xl transition-all duration-300 hover:shadow-2xl hover:border-white/20">
                  <CardHeader>
                    <CardTitle className="text-white group-hover:text-emerald-300 transition-colors">
                      {post.title}
                    </CardTitle>
                    <CardDescription className="text-slate-300">
                      {post.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
