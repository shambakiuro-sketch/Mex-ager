'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'

export default function ContactSection() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    project: '',
    message: '',
  })

  const [isSubmitted, setIsSubmitted] = useState(false)

  const contactInfo = [
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      label: 'Address',
      value: '38 Tindale Way, Hanover, MA 02339',
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      ),
      label: 'Phone',
      value: '(351) 230-0018',
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      label: 'Email',
      value: 'caldwellconstructioninc@yahoo.com',
    },
  ]

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // Handle form submission
    setIsSubmitted(true)
    setTimeout(() => {
      setFormData({
        name: '',
        email: '',
        phone: '',
        project: '',
        message: '',
      })
      setIsSubmitted(false)
    }, 3000)
  }

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
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
  }

  return (
    <section id="contact" className="py-20 bg-white">
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
            Get In Touch
          </h2>
          <p className="text-gray-700 text-lg max-w-2xl mx-auto">
            Ready to start your next project? Contact us today for a free consultation
          </p>
          <div className="w-24 h-1 bg-[#D97E3A] mx-auto mt-4" />
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Contact information */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <h3 className="text-2xl font-bold text-[#1F3A93] mb-8">
              Contact Information
            </h3>

            {contactInfo.map((info, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                className="flex gap-4 mb-8"
              >
                <div className="text-[#D97E3A] flex-shrink-0">
                  {info.icon}
                </div>
                <div>
                  <p className="font-semibold text-[#1F3A93] mb-1">
                    {info.label}
                  </p>
                  <p className="text-gray-700">{info.value}</p>
                </div>
              </motion.div>
            ))}

            {/* Quick links */}
            <motion.div
              variants={itemVariants}
              className="mt-12 p-8 bg-[#f8f9fa] rounded-xl"
            >
              <h4 className="font-bold text-[#1F3A93] mb-4">Business Hours</h4>
              <div className="space-y-2 text-gray-700 mb-6">
                <p>Monday - Friday: 7:00 AM - 5:00 PM</p>
                <p>Saturday: 8:00 AM - 2:00 PM</p>
                <p>Sunday: Closed</p>
              </div>

              <div className="border-t border-gray-300 pt-6">
                <h4 className="font-bold text-[#1F3A93] mb-2">Company Info</h4>
                <p className="text-gray-700">
                  <span className="font-semibold">Date of Organization:</span> 05-27-2021
                </p>
              </div>
            </motion.div>
          </motion.div>

          {/* Contact form */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <label className="block text-gray-800 font-semibold mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#D97E3A] focus:outline-none transition-colors"
                  placeholder="Your name"
                />
              </motion.div>

              {/* Email */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <label className="block text-gray-800 font-semibold mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#D97E3A] focus:outline-none transition-colors"
                  placeholder="your@email.com"
                />
              </motion.div>

              {/* Phone */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <label className="block text-gray-800 font-semibold mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#D97E3A] focus:outline-none transition-colors"
                  placeholder="(123) 456-7890"
                />
              </motion.div>

              {/* Project type */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                <label className="block text-gray-800 font-semibold mb-2">
                  Project Type
                </label>
                <select
                  name="project"
                  value={formData.project}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#D97E3A] focus:outline-none transition-colors"
                >
                  <option value="">Select project type</option>
                  <option value="new-construction">New Construction</option>
                  <option value="renovation">Renovation & Remodeling</option>
                  <option value="repair">General Repairs</option>
                  <option value="other">Other</option>
                </select>
              </motion.div>

              {/* Message */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
              >
                <label className="block text-gray-800 font-semibold mb-2">
                  Project Details
                </label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows="5"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#D97E3A] focus:outline-none transition-colors resize-none"
                  placeholder="Tell us about your project..."
                />
              </motion.div>

              {/* Submit button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isSubmitted}
                className="w-full bg-[#D97E3A] text-white py-3 rounded-lg font-bold text-lg hover:bg-[#c66b28] transition-all disabled:bg-green-500"
              >
                {isSubmitted ? '✓ Message Sent!' : 'Send Message'}
              </motion.button>
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
