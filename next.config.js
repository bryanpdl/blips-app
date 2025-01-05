/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'lh3.googleusercontent.com',  // Google user profile photos
      'firebasestorage.googleapis.com'  // Firebase Storage images
    ],
  },
}

module.exports = nextConfig 