import React from "react";
import { Link } from "wouter";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function WarehouseOS() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-white">
      <Nav />
      <main className="flex-1 pt-24 px-4 md:px-8">
        <article className="prose prose-slate md:prose-lg mx-auto">
          <h1 className="mb-4">warehouseOS – our first vertical</h1>
          <p>
            Blueprint is building the operating system for physical spaces—our motto is
            <strong>"know the place to serve the person."</strong> warehouseOS brings that
            vision to distribution centers and fulfillment sites, blending AR and AI to
            understand every aisle, rack and bin so people can work faster and safer.
          </p>
          <h2>Key capabilities</h2>
          <ul>
            <li>Ask where any SKU lives and get an AR path directly to the bin.</li>
            <li>Vision picking with hands-free confirmations cuts walking and errors.</li>
            <li>Smart slotting suggestions and putaway guidance reduce travel time.</li>
            <li>Safety overlays warn about forklifts, no-go zones and pedestrian traffic.</li>
            <li>Cycle counting and receiving QA use computer vision for instant accuracy.</li>
          </ul>
          <h2>ROI snapshot</h2>
          <ul>
            <li>15–25% faster picks compared to paper or handheld scanners.</li>
            <li>Mispicks often cost $22–$100 each; halving them saves six figures yearly.</li>
            <li>AR-guided training can cut ramp time by 50% or more.</li>
          </ul>
          <p>
            warehouseOS is just the beginning. By treating location as a first-class
            interface, Blueprint unlocks new efficiency and safety gains for every type of
            facility.
          </p>
          <p>
            <Link href="/blog" className="text-blue-600">&larr; Back to all posts</Link>
          </p>
        </article>
      </main>
      <Footer />
    </div>
  );
}
