export default function myLoader({ src, width, quality }) {
    // For static export, just return the URL for the image
    return `${src}?w=${width}&q=${quality || 75}`
} 