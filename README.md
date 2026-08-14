# Caldwell Construction Inc. - Professional Website

A modern, professional Next.js website for Caldwell Construction Inc. built with React, Framer Motion animations, and Tailwind CSS.

## 🎨 Features

- **Professional Design** - Modern and clean UI with brand colors
- **Smooth Animations** - Framer Motion powered transitions and interactions
- **Fully Responsive** - Mobile-first design that works on all devices
- **Fast Performance** - Optimized Next.js for quick loading
- **SEO Optimized** - Meta tags and structured data for search engines
- **Contact Form** - Interactive form for client inquiries
- **Professional Branding** - Logo integration and consistent styling

## 📋 Sections

1. **Hero Section** - Eye-catching introduction with tagline
2. **About Section** - Company information and core values
3. **Services Section** - Overview of construction services
4. **Team Section** - Team member profiles and bios
5. **Testimonials Section** - Client reviews and ratings
6. **Contact Section** - Contact form and business information
7. **Footer** - Links and company details

## 🚀 Getting Started

### Prerequisites

- Node.js 16+ and npm installed
- Code editor (VS Code recommended)

### Installation

1. **Extract the project**
   ```bash
   cd caldwell-construction
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   ```
   http://localhost:3000
   ```

## 🏗️ Project Structure

```
caldwell-construction/
├── app/
│   ├── layout.jsx          # Root layout
│   ├── page.jsx            # Main page
│   └── globals.css         # Global styles
├── components/
│   ├── Navbar.jsx
│   ├── HeroSection.jsx
│   ├── AboutSection.jsx
│   ├── ServicesSection.jsx
│   ├── TeamSection.jsx
│   ├── TestimonialsSection.jsx
│   ├── ContactSection.jsx
│   └── Footer.jsx
├── package.json
├── next.config.js
├── tailwind.config.js
└── postcss.config.js
```

## 🎯 Customization

### Update Company Info
- Edit contact details in `ContactSection.jsx`
- Update phone, email, and address

### Change Colors
- Primary Blue: `#1F3A93`
- Accent Orange: `#D97E3A`
- Gold: `#D4A574`
- Gray: `#4A4A4A`

### Add Logo
- Place your logo image in the `public` folder as `logo.png`
- Update image paths in components if needed

### Modify Content
- Edit section titles and text in component files
- Update team member information
- Add/remove services or testimonials

## 📱 Responsive Design

The website is fully responsive with breakpoints for:
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

## 🚀 Deployment

### Deploy to Vercel (Recommended)

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Connect to Vercel**
   - Go to vercel.com
   - Import your GitHub repository
   - Click Deploy

3. **Custom Domain**
   - Add your domain in Vercel settings
   - Update DNS records as instructed

### Environment Variables

Create a `.env.local` file if needed:
```
NEXT_PUBLIC_API_URL=your_api_url
```

## 🛠️ Build for Production

```bash
npm run build
npm start
```

## 📞 Contact Information

- **Email**: caldwellconstructioninc@yahoo.com
- **Phone**: (351) 230-0018
- **Address**: 38 TINDALE WAY, Hanover, MA 02339
- **Website**: https://caldwellconstruction.com

## 📄 License

All rights reserved © 2024 Caldwell Construction Inc.

## 🤝 Support

For questions or issues, contact the development team or visit the company website.

---

**Built with ❤️ using Next.js, React, Framer Motion, and Tailwind CSS**
