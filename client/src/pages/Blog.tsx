import React from "react";
import { Link } from "wouter";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Blog() {
  const posts = [
    {
      title: "warehouseOS – our first vertical",
      description: "How Blueprint brings AR and AI to warehouses for faster, safer operations.",
      href: "/blog/warehouse-os",
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-white">
      <Nav />
      <main className="flex-1 pt-24 px-4 md:px-8">
        <section className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-8 gradient-text">Blueprint Blog</h1>
          <div className="grid gap-6 md:grid-cols-2">
            {posts.map((post) => (
              <Link key={post.href} href={post.href} className="block group">
                <Card className="h-full hover:shadow-xl transition-shadow">
                  <CardHeader>
                    <CardTitle className="group-hover:text-blue-600 transition-colors">
                      {post.title}
                    </CardTitle>
                    <CardDescription>{post.description}</CardDescription>
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
