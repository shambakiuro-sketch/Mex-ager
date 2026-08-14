'use client'

import { motion } from 'framer-motion'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.3,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: 'easeOut' },
  },
}

export default function HeroSection() {
  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden bg-cover bg-center"
      style={{
        backgroundImage: 'url(/hero.png)',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-black bg-opacity-40 z-0" />

      {/* Content */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-4xl mx-auto px-4 text-center"
      >
        {/* Logo animation */}
        <motion.div
          variants={itemVariants}
          className="mb-8"
        >
          <motion.img
            src="/logo.png"
            alt="Caldwell Construction"
            className="h-32 mx-auto drop-shadow-lg"
            animate={{
              y: [0, -10, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </motion.div>

        {/* Main heading */}
        <motion.h1
          variants={itemVariants}
          className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight"
        >
          CALDWELL <br />
          <span className="text-[#D97E3A]">CONSTRUCTION</span>
        </motion.h1>

        {/* Tagline */}
        <motion.div
          variants={itemVariants}
          className="mb-8"
        >
          <p className="text-2xl md:text-3xl text-[#D4A574] font-semibold tracking-widest">
            BUILT TO ENDURE
          </p>
          <div className="w-24 h-1 bg-[#D97E3A] mx-auto mt-4" />
        </motion.div>

        {/* Description */}
        <motion.p
          variants={itemVariants}
          className="text-lg md:text-xl text-white mb-10 max-w-2xl mx-auto opacity-90"
        >
          Professional general contracting services crafted with precision and backed by decades of excellence. We build relationships that last as long as the structures we create.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col md:flex-row gap-6 justify-center items-center"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-[#D97E3A] text-white px-10 py-4 rounded-lg font-bold text-lg hover:bg-[#c66b28] transition-all shadow-lg"
          >
            Start Your Project
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="border-2 border-white text-white px-10 py-4 rounded-lg font-bold text-lg hover:bg-white hover:text-[#1F3A93] transition-all"
          >
            Learn More
          </motion.button>
        </motion.div>
      </motion.div>


    </section>
  )
}
