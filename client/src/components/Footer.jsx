// ==================================
// File: src/components/Footer.jsx
// ==================================

import React from "react";
import { motion } from "framer-motion";

export default function Footer() {
  const year = new Date().getFullYear();
  const variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.2 },
    },
  };
  const item = { hidden: { y: 12, opacity: 0 }, visible: { y: 0, opacity: 1 } };

  return (
    <footer className="relative bg-slate-950 text-slate-300 pt-14 pb-10 overflow-hidden border-t border-slate-800">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-emerald-500/60 via-cyan-400/60 to-emerald-500/60" />
        <div className="absolute -top-32 -right-32 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <motion.div
        className="container mx-auto px-6"
        variants={variants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
          {/* Brand */}
          <motion.div variants={item} className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <img
                src="/gradientBPLogo.png"
                alt="Blueprint Logo"
                className="w-10 h-10 rounded-xl"
              />
              <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">
                Blueprint
              </h3>
            </div>
            <p className="text-slate-400 max-w-xl">
              Simulation data that complements your real-world capture. Physics-accurate
              environments with domain randomization and sim2real validation—designed to
              boost your models by up to 38%.
            </p>
            <div className="flex items-center gap-4 mt-5 text-slate-400">
              <a
                href="#"
                aria-label="Twitter"
                className="hover:text-white transition"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M22.46 6c-.77.35-1.6.58-2.46.69a4.23 4.23 0 001.85-2.33 8.38 8.38 0 01-2.67 1.03 4.19 4.19 0 00-7.13 3.82A11.9 11.9 0 013 4.79a4.18 4.18 0 001.3 5.59 4.17 4.17 0 01-1.9-.52v.05a4.19 4.19 0 003.36 4.11c-.46.13-.94.2-1.43.2-.35 0-.69-.03-1.02-.1a4.2 4.2 0 003.91 2.9A8.4 8.4 0 012 19.54a11.86 11.86 0 006.44 1.89c7.73 0 11.95-6.41 11.95-11.96 0-.18 0-.35-.01-.53A8.48 8.48 0 0024 5.56a8.3 8.3 0 01-2.4.66z" />
                </svg>
              </a>
              <a
                href="#"
                aria-label="LinkedIn"
                className="hover:text-white transition"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M4.98 3.5C4.98 4.88 3.86 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM0 8h5v15H0zM8 8h4.7v2.2h.1c.7-1.2 2.3-2.5 4.8-2.5 5.1 0 6 3.4 6 7.8V23H18v-6.3c0-1.5 0-3.4-2.1-3.4-2.1 0-2.4 1.6-2.4 3.3V23H8z" />
                </svg>
              </a>
              <a
                href="#"
                aria-label="GitHub"
                className="hover:text-white transition"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.86 9.71.5.09.68-.22.68-.48 0-.24-.01-.87-.02-1.7-2.79.62-3.39-1.35-3.39-1.35-.45-1.16-1.12-1.47-1.12-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.26-4.56-1.12-4.56-4.98 0-1.1.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03.81-.23 1.68-.35 2.55-.35.87 0 1.73.12 2.54.35 1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.69 0 3.85-2.34 4.7-4.57 4.95.36.3.68.92.68 1.86 0 1.34-.01 2.42-.01 2.75 0 .27.18.58.69.48A10.04 10.04 0 0022 12.26C22 6.58 17.52 2 12 2z"
                  />
                </svg>
              </a>
              <a
                href="#"
                aria-label="Instagram"
                className="hover:text-white transition"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 2.2c3.2 0 3.58.01 4.84.07 1.17.05 1.95.24 2.56.5.62.24 1.15.57 1.67 1.09.52.52.85 1.05 1.1 1.67.26.6.45 1.39.5 2.55.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.84c-.05 1.17-.24 1.95-.5 2.56-.24.62-.57 1.15-1.09 1.67-.52.52-1.05.85-1.67 1.1-.6.26-1.39.45-2.55.5-1.27.06-1.65.07-4.85.07s-3.58-.01-4.84-.07c-1.17-.05-1.95-.24-2.56-.5a4.8 4.8 0 01-1.67-1.09 4.8 4.8 0 01-1.1-1.67c-.26-.6-.45-1.39-.5-2.55C2.21 15.58 2.2 15.2 2.2 12s.01-3.58.07-4.84c.05-1.17.24-1.95.5-2.56.24-.62.57-1.15 1.09-1.67.52-.52 1.05-.85 1.67-1.1.6-.26 1.39-.45 2.55-.5C8.42 2.21 8.8 2.2 12 2.2zm0 3.1c-3.14 0-3.51.01-4.75.07-.98.05-1.51.21-1.87.34-.47.18-.78.4-1.12.74-.34.34-.55.65-.74 1.12-.13.36-.29.9-.34 1.88-.06 1.24-.07 1.61-.07 4.75s.01 3.51.07 4.75c.05.98.21 1.51.34 1.87.18.47.4.78.74 1.12.34.34.65.55 1.12.74.36.13.9.29 1.88.34 1.24.06 1.61.07 4.75.07s3.51-.01 4.75-.07c.98-.05 1.51-.21 1.87-.34.47-.18.78-.4 1.12-.74.34-.34.55-.65.74-1.12.13-.36.29-.9.34-1.88.06-1.24.07-1.61.07-4.75s-.01-3.51-.07-4.75c-.05-.98-.21-1.51-.34-1.87-.18-.47-.4-.78-.74-1.12a2.7 2.7 0 00-1.12-.74c-.36-.13-.9-.29-1.88-.34-1.24-.06-1.61-.07-4.75-.07zm0 3.76a4.94 4.94 0 110 9.88 4.94 4.94 0 010-9.88zm0 2.2a2.74 2.74 0 100 5.48 2.74 2.74 0 000-5.48zm5.42-3.23a1.15 1.15 0 110 2.3 1.15 1.15 0 010-2.3z"
                  />
                </svg>
              </a>
            </div>
          </motion.div>

          {/* Resources */}
          <motion.div variants={item}>
            <h4 className="text-sm font-semibold tracking-wider text-slate-400 uppercase mb-4">
              Resources
            </h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="/why-simulation"
                  className="text-slate-400 hover:text-white transition flex items-center"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2" />{" "}
                  Why Simulation?
                </a>
              </li>
              <li>
                <a
                  href="/learn"
                  className="text-slate-400 hover:text-white transition flex items-center"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2" />{" "}
                  Getting Started
                </a>
              </li>
              <li>
                <a
                  href="/privacy"
                  className="text-slate-400 hover:text-white transition flex items-center"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2" />{" "}
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href="/terms"
                  className="text-slate-400 hover:text-white transition flex items-center"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2" />{" "}
                  Terms of Service
                </a>
              </li>
            </ul>
          </motion.div>
        </div>

        <motion.div
          variants={item}
          className="pt-6 mt-2 border-t border-slate-800 text-center md:flex md:items-center md:justify-between"
        >
          <p className="text-sm text-slate-500">
            © {year} Blueprint. All rights reserved.
          </p>
          <div className="mt-4 md:mt-0 flex justify-center md:justify-end gap-6">
            <a
              href="/privacy"
              className="text-sm text-slate-500 hover:text-slate-300 transition"
            >
              Privacy Policy
            </a>
            <a
              href="/terms"
              className="text-sm text-slate-500 hover:text-slate-300 transition"
            >
              Terms of Service
            </a>
          </div>
        </motion.div>
      </motion.div>
    </footer>
  );
}

// // This file defines the Footer component, which is displayed at the bottom of all pages.
// // It includes links to resources, company information, and copyright information.

// import { motion } from "framer-motion";

// /**
//  * The Footer component is displayed at the bottom of all pages.
//  * It includes links to resources, company information,
//  * and copyright information.
//  *
//  * @returns {JSX.Element} The rendered Footer component.
//  */
// export default function Footer() {
//   // Animation variants
//   const footerVariants = {
//     hidden: { opacity: 0 },
//     visible: {
//       opacity: 1,
//       transition: {
//         staggerChildren: 0.1,
//         delayChildren: 0.3,
//       },
//     },
//   };

//   const itemVariants = {
//     hidden: { y: 20, opacity: 0 },
//     visible: {
//       y: 0,
//       opacity: 1,
//       transition: { type: "spring", stiffness: 50 },
//     },
//   };

//   return (
//     <footer className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white pt-20 pb-10 overflow-hidden">
//       {/* Background design elements */}
//       <div className="absolute inset-0 overflow-hidden pointer-events-none">
//         <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-80"></div>

//         <motion.div
//           className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-900/20 rounded-full blur-3xl"
//           animate={{
//             scale: [1, 1.2, 1],
//             opacity: [0.2, 0.3, 0.2],
//           }}
//           transition={{
//             duration: 15,
//             repeat: Infinity,
//             repeatType: "reverse",
//           }}
//         />

//         <motion.div
//           className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-900/20 rounded-full blur-3xl"
//           animate={{
//             scale: [1, 1.3, 1],
//             opacity: [0.2, 0.3, 0.2],
//           }}
//           transition={{
//             duration: 20,
//             repeat: Infinity,
//             repeatType: "reverse",
//             delay: 2,
//           }}
//         />

//         {/* Grid pattern */}
//         <div className="absolute inset-0 bg-[url('/images/grid-pattern-dark.svg')] bg-repeat opacity-5"></div>
//       </div>

//       <motion.div
//         className="container mx-auto px-4"
//         variants={footerVariants}
//         initial="hidden"
//         whileInView="visible"
//         viewport={{ once: true, amount: 0.2 }}
//       >
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">
//           {/* Brand/Company */}
//           <motion.div variants={itemVariants} className="md:col-span-1">
//             <div className="flex items-center gap-3 mb-4">
//               <div className="flex items-center gap-3 mb-4">
//                 <div className="w-10 h-10 rounded-full overflow-hidden transition-all duration-300 shadow-lg">
//                   <img
//                     src="/gradientBPLogo.png"
//                     alt="Blueprint Logo"
//                     className="w-full h-full object-cover"
//                   />
//                 </div>
//                 <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-300 to-indigo-300 inline-block text-transparent bg-clip-text">
//                   Blueprint
//                 </h3>
//               </div>
//             </div>
//             <p className="text-gray-400 leading-relaxed mb-6">
//               Transforming physical spaces with cutting-edge AR technology for
//               enhanced customer experiences. No app required.
//             </p>
//             <div className="flex items-center gap-4 text-gray-400">
//               <a
//                 href="#"
//                 className="hover:text-indigo-400 transition-colors duration-300"
//                 aria-label="Twitter"
//               >
//                 <svg
//                   className="w-6 h-6"
//                   fill="currentColor"
//                   viewBox="0 0 24 24"
//                   aria-hidden="true"
//                 >
//                   <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"></path>
//                 </svg>
//               </a>
//               <a
//                 href="#"
//                 className="hover:text-indigo-400 transition-colors duration-300"
//                 aria-label="LinkedIn"
//               >
//                 <svg
//                   className="w-6 h-6"
//                   fill="currentColor"
//                   viewBox="0 0 24 24"
//                   aria-hidden="true"
//                 >
//                   <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
//                 </svg>
//               </a>
//               <a
//                 href="#"
//                 className="hover:text-indigo-400 transition-colors duration-300"
//                 aria-label="GitHub"
//               >
//                 <svg
//                   className="w-6 h-6"
//                   fill="currentColor"
//                   viewBox="0 0 24 24"
//                   aria-hidden="true"
//                 >
//                   <path
//                     fillRule="evenodd"
//                     d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
//                     clipRule="evenodd"
//                   />
//                 </svg>
//               </a>
//               <a
//                 href="#"
//                 className="hover:text-indigo-400 transition-colors duration-300"
//                 aria-label="Instagram"
//               >
//                 <svg
//                   className="w-6 h-6"
//                   fill="currentColor"
//                   viewBox="0 0 24 24"
//                   aria-hidden="true"
//                 >
//                   <path
//                     fillRule="evenodd"
//                     d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z"
//                     clipRule="evenodd"
//                   />
//                 </svg>
//               </a>
//             </div>
//           </motion.div>

//           {/* Resources */}
//           <motion.div variants={itemVariants} className="md:col-span-1">
//             <h4 className="text-lg font-semibold mb-5 text-indigo-300">
//               Resources
//             </h4>
//             <ul className="space-y-3">
//               <li>
//                 <a
//                   href="/privacy"
//                   className="text-gray-400 hover:text-white transition-colors duration-300 flex items-center"
//                 >
//                   <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mr-2"></span>
//                   Privacy Policy
//                 </a>
//               </li>
//               <li>
//                 <a
//                   href="/terms"
//                   className="text-gray-400 hover:text-white transition-colors duration-300 flex items-center"
//                 >
//                   <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mr-2"></span>
//                   Terms of Service
//                 </a>
//               </li>
//               <li>
//                 <a
//                   href="/faq"
//                   className="text-gray-400 hover:text-white transition-colors duration-300 flex items-center"
//                 >
//                   <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mr-2"></span>
//                   FAQ
//                 </a>
//               </li>
//             </ul>
//           </motion.div>
//         </div>

//         {/* Bottom Bar */}
//         <motion.div
//           variants={itemVariants}
//           className="pt-8 mt-8 border-t border-gray-800 text-center md:flex md:justify-between md:items-center"
//         >
//           <p className="text-sm text-gray-500">
//             © {new Date().getFullYear()} Blueprint. All rights reserved.
//           </p>
//           <div className="mt-4 md:mt-0 flex justify-center md:justify-end space-x-6">
//             <a
//               href="/privacy"
//               className="text-sm text-gray-500 hover:text-gray-300 transition-colors duration-300"
//             >
//               Privacy Policy
//             </a>
//             <a
//               href="/terms"
//               className="text-sm text-gray-500 hover:text-gray-300 transition-colors duration-300"
//             >
//               Terms of Service
//             </a>
//           </div>
//         </motion.div>
//       </motion.div>
//     </footer>
//   );
// }
