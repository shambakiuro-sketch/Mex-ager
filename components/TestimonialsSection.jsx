'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'

export default function TestimonialsSection() {
  const testimonials = [
    {
      name: 'Michael Thompson',
      company: 'Thompson Enterprises',
      rating: 5,
      text: 'Caldwell Construction exceeded our expectations. Professional, reliable, and delivered ahead of schedule. Highly recommended!',
    },
    {
      name: 'Jennifer Walsh',
      company: 'Walsh Dental Center',
      rating: 5,
      text: 'The team transformed our office space beautifully. Great communication throughout and quality workmanship.',
    },
    {
      name: 'David Chen',
      company: 'Chen Retail Group',
      rating: 5,
      text: 'From initial consultation to completion, Caldwell Construction was exceptional. They treated our project like their own.',
    },
    {
      name: 'Amanda Garcia',
      company: 'Garcia Properties',
      rating: 5,
      text: 'Best construction company we have worked with. Professional team, quality results, and great communication.',
    },
  ]

  const [activeIndex, setActiveIndex] = useState(0)

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.6 },
    },
  }

  return (
    <section id="testimonials" className="py-20 bg-[#f8f9fa]">
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
            Client Testimonials
          </h2>
          <p className="text-gray-700 text-lg max-w-2xl mx-auto">
            Hear what our satisfied clients have to say about working with us
          </p>
          <div className="w-24 h-1 bg-[#D97E3A] mx-auto mt-4" />
        </motion.div>

        {/* Testimonials grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-2 gap-8 mb-12"
        >
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              whileHover={{
                boxShadow: '0 20px 40px rgba(217, 126, 58, 0.2)',
              }}
              onClick={() => setActiveIndex(index)}
              className={`p-8 rounded-xl transition-all cursor-pointer ${
                activeIndex === index
                  ? 'bg-white shadow-2xl border-2 border-[#D97E3A]'
                  : 'bg-white shadow-lg border-2 border-transparent'
              }`}
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <span key={i} className="text-[#D97E3A] text-xl">
                    ★
                  </span>
                ))}
              </div>

              {/* Quote text */}
              <motion.p
                className="text-gray-700 text-lg italic mb-6 leading-relaxed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                "{testimonial.text}"
              </motion.p>

              {/* Author info */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#D97E3A] to-[#D4A574] flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-lg">
                    {testimonial.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-[#1F3A93]">{testimonial.name}</p>
                  <p className="text-gray-600 text-sm">{testimonial.company}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Testimonials dots */}
        <motion.div
          className="flex justify-center gap-3"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {testimonials.map((_, index) => (
            <motion.button
              key={index}
              onClick={() => setActiveIndex(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                activeIndex === index
                  ? 'bg-[#D97E3A] w-8'
                  : 'bg-gray-400'
              }`}
              whileHover={{ scale: 1.2 }}
            />
          ))}
        </motion.div>
      </div>
    </section>
  )
}
