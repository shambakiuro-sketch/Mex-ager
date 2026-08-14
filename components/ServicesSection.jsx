'use client'

import { motion } from 'framer-motion'

export default function ServicesSection() {
  const services = [
    {
      image: '/new construction.png',
      title: 'New Construction',
      description: 'Building projects from the ground up with precision and expertise.',
    },
    {
      image: '/renovations&remodeling.png',
      title: 'Renovations & Remodeling',
      description: 'Transform existing spaces with modern design and quality craftsmanship.',
    },
    {
      image: '/general repair.png',
      title: 'General Repairs',
      description: 'Professional repair services to maintain and enhance your property.',
    },
    {
      image: '/project management.png',
      title: 'Project Management',
      description: 'Expert oversight ensuring projects stay on schedule and budget.',
    },
    {
      image: '/custom design-build.png',
      title: 'Custom Design-Build',
      description: 'Tailored solutions that bring your vision to life.',
    },
    {
      image: '/quality assurance.png',
      title: 'Quality Assurance',
      description: 'Rigorous inspection protocols for superior results.',
    },
  ]

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
    <section id="services" className="py-20 bg-[#f8f9fa]">
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
            Our Services
          </h2>
          <p className="text-gray-700 text-lg max-w-2xl mx-auto">
            Comprehensive construction services tailored to your needs
          </p>
          <div className="w-24 h-1 bg-[#D97E3A] mx-auto mt-4" />
        </motion.div>

        {/* Services grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-3 gap-8"
        >
          {services.map((service, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              whileHover={{
                y: -10,
                boxShadow: '0 20px 40px rgba(31, 58, 147, 0.1)',
              }}
              className="relative h-80 rounded-xl shadow-lg overflow-hidden transition-all cursor-pointer group"
            >
              {/* Background image */}
              <img
                src={service.image}
                alt={service.title}
                className="absolute inset-0 w-full h-full object-cover"
              />

              {/* Overlay gradient */}
              <div className="absolute inset-0 bg-black bg-opacity-50 group-hover:bg-opacity-60 transition-all duration-300" />

              {/* Content overlay */}
              <div className="absolute inset-0 p-6 flex flex-col justify-end text-white">
                <h3 className="text-2xl font-bold mb-3">
                  {service.title}
                </h3>
                <p className="text-gray-100 leading-relaxed">
                  {service.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
