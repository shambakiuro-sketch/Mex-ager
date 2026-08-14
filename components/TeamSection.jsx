'use client'

import { motion } from 'framer-motion'

export default function TeamSection() {
  const teamMembers = [
    {
      name: 'Robert Caldwell',
      title: 'Founder & Chief Executive',
      image: '👨‍💼',
      bio: 'With 25+ years in construction, Robert founded Caldwell Construction on principles of excellence and integrity.',
    },
    {
      name: 'Sarah Mitchell',
      title: 'Project Manager',
      image: '👩‍💼',
      bio: 'Sarah ensures every project exceeds expectations with meticulous attention to detail and clear communication.',
    },
    {
      name: 'James Rodriguez',
      title: 'Senior Builder',
      image: '👨‍🔧',
      bio: 'James brings two decades of hands-on construction experience and expertise to every project.',
    },
    {
      name: 'Emily Chen',
      title: 'Design Consultant',
      image: '👩‍🎨',
      bio: 'Emily transforms visions into reality with innovative design solutions and technical expertise.',
    },
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.6, ease: 'easeOut' },
    },
  }

  return (
    <section id="team" className="py-20 bg-white">
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
            Our Team
          </h2>
          <p className="text-gray-700 text-lg max-w-2xl mx-auto">
            Meet the experienced professionals dedicated to your project's success
          </p>
          <div className="w-24 h-1 bg-[#D97E3A] mx-auto mt-4" />
        </motion.div>

        {/* Team members grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-4 gap-8"
        >
          {teamMembers.map((member, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              whileHover={{
                y: -15,
                boxShadow: '0 30px 60px rgba(217, 126, 58, 0.15)',
              }}
              className="bg-gradient-to-br from-[#f8f9fa] to-white rounded-xl overflow-hidden shadow-lg transition-all"
            >
              {/* Avatar section */}
              <motion.div
                className="w-full aspect-square bg-gradient-to-br from-[#1F3A93] to-[#D97E3A] flex items-center justify-center text-8xl"
                whileHover={{ scale: 1.05 }}
              >
                {member.image}
              </motion.div>

              {/* Info section */}
              <div className="p-6">
                <h3 className="text-xl font-bold text-[#1F3A93] mb-1">
                  {member.name}
                </h3>
                <p className="text-[#D97E3A] font-semibold mb-4 text-sm">
                  {member.title}
                </p>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {member.bio}
                </p>

                {/* Social icons */}
                <motion.div
                  className="flex gap-3 mt-6"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <motion.button
                    whileHover={{ scale: 1.2 }}
                    className="text-[#1F3A93] hover:text-[#D97E3A] transition-colors text-lg"
                  >
                    🔗
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.2 }}
                    className="text-[#1F3A93] hover:text-[#D97E3A] transition-colors text-lg"
                  >
                    📧
                  </motion.button>
                </motion.div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
