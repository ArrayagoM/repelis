/**
 * Botón oficial de Cafecito (imagen servida por su CDN).
 * Reusable en todos lados — recibe `className` para wrapper.
 */
export default function CafecitoButton({ className = '' }) {
  return (
    <a
      href="https://cafecito.app/tintech"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-block transition-transform duration-200 hover:scale-105 active:scale-95 ${className}`}
      aria-label="Invitame un café en cafecito.app"
    >
      <img
        srcSet="https://cdn.cafecito.app/imgs/buttons/button_5.png 1x, https://cdn.cafecito.app/imgs/buttons/button_5_2x.png 2x, https://cdn.cafecito.app/imgs/buttons/button_5_3.75x.png 3.75x"
        src="https://cdn.cafecito.app/imgs/buttons/button_5.png"
        alt="Invitame un café en cafecito.app"
        loading="lazy"
        decoding="async"
        className="block max-w-full h-auto"
      />
    </a>
  )
}
