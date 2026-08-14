'use client'

import { motion } from 'framer-motion'

export default function AboutSection() {
  // Calculate years from organization date (05-27-2021)
  const orgDate = new Date(2021, 4, 27); // May 27, 2021
  const today = new Date();
  const yearsExperience = Math.floor((today - orgDate) / (1000 * 60 * 60 * 24 * 365.25));

  const stats = [
    { number: '50+', label: 'Projects Completed' },
    { number: `${yearsExperience}+`, label: 'Years Experience' },
    { number: '100%', label: 'Client Satisfaction' },
  ]

  return (
    <section id="about" className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-[#1F3A93] mb-4">
            About Caldwell Construction
          </h2>
          <div className="w-24 h-1 bg-[#D97E3A] mx-auto" />
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Text content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h3 className="text-3xl font-bold text-[#1F3A93] mb-6">
              Quality Construction Built on Trust
            </h3>
            <p className="text-gray-700 text-lg mb-4 leading-relaxed">
              With over two decades of experience in the construction industry, Caldwell Construction Inc. has established itself as a trusted partner for general contracting needs. We specialize in delivering exceptional results that exceed expectations.
            </p>
            <p className="text-gray-700 text-lg mb-8 leading-relaxed">
              Our commitment to quality, safety, and customer satisfaction drives everything we do. From the initial consultation to final completion, we maintain the highest standards of professionalism and craftsmanship.
            </p>

            {/* Core values */}
            <div className="space-y-3">
              {['Professional Excellence', 'Safety First', 'Timely Delivery', 'Transparent Communication'].map((value, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="flex items-center gap-3"
                >
                  <div className="w-2 h-2 bg-[#D97E3A] rounded-full" />
                  <span className="text-gray-800 font-medium">{value}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Image placeholder */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="w-full aspect-square rounded-2xl bg-gradient-to-br from-[#1F3A93] to-[#D97E3A] shadow-2xl flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">🏗️</div>
                <p className="text-white font-bold">Professional Construction Services</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Stats section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="grid grid-cols-3 gap-8 mt-20 p-8 bg-[#f8f9fa] rounded-xl"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              className="text-center"
              whileHover={{ scale: 1.05 }}
            >
              <div className="text-4xl md:text-5xl font-bold text-[#D97E3A] mb-2">
                {stat.number}
              </div>
              <p className="text-gray-700 font-medium">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
