'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  const footerLinks = [
    {
      title: 'Company',
      links: ['About', 'Services', 'Contact'],
    },
    {
      title: 'Services',
      links: ['New Construction', 'Renovations', 'Repairs', 'Design-Build'],
    },
    {
      title: 'Contact',
      links: [
        '(351) 230-0018',
        'caldwellconstructioninc@yahoo.com',
        '38 Tindale Way, Hanover, MA 02339',
      ],
    },
  ]

  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      viewport={{ once: true }}
      className="bg-[#1F3A93] text-white"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          {/* Brand section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-2 mb-4">
              <img
                src="/logo.png"
                alt="Caldwell Construction"
                className="h-8 w-auto"
              />
              <span className="font-bold">CALDWELL</span>
            </div>
            <p className="text-[#D4A574] font-semibold tracking-widest mb-4">
              Built to Endure
            </p>
            <p className="text-gray-300 text-sm leading-relaxed">
              Professional general contracting services crafted with precision and excellence.
            </p>
          </motion.div>

          {/* Links columns */}
          {footerLinks.map((column, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <h4 className="font-bold text-lg mb-4 text-[#D97E3A]">
                {column.title}
              </h4>
              <ul className="space-y-2">
                {column.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    <a
                      href="#"
                      className="text-gray-300 hover:text-[#D97E3A] transition-colors text-sm"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Divider */}
        <motion.div
          className="h-px bg-gray-700 mb-8"
          initial={{ width: 0 }}
          whileInView={{ width: '100%' }}
          transition={{ duration: 0.8 }}
        />

        {/* Bottom section */}
        <motion.div
          className="flex flex-col md:flex-row justify-between items-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
        >
          <p className="text-gray-400 text-sm">
            © {currentYear} Caldwell Construction Inc. All rights reserved.
          </p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#" className="text-gray-400 hover:text-[#D97E3A] transition-colors">
              Facebook
            </a>
            <a href="#" className="text-gray-400 hover:text-[#D97E3A] transition-colors">
              LinkedIn
            </a>
            <a href="#" className="text-gray-400 hover:text-[#D97E3A] transition-colors">
              Twitter
            </a>
          </div>
        </motion.div>
      </div>
    </motion.footer>
  )
}
