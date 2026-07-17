export default function Card({ children, className = '', hover = false, ...props }) {
  return (
    <div
      className={`card animate-fade-in ${hover ? 'hover:shadow-md hover:scale-[1.01] transition-all duration-200' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
