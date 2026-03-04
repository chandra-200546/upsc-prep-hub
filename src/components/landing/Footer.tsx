import logo from "@/assets/upsc-mentor-logo.jpeg";
import fiveuLogo from "@/assets/fiveu-logo.jpeg";

const Footer = () => {
  return (
    <footer className="py-12 bg-card border-t border-border">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center text-center">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-4">
            <img
              src={logo}
              alt="UPSC Mentor Logo"
              className="w-10 h-10 rounded-full object-cover"
            />
            <span className="text-xl font-bold">UPSC Mentor</span>
          </div>
          
          {/* Tagline */}
          <p className="text-muted-foreground text-sm mb-6 max-w-md">
            Your AI-powered companion for UPSC preparation. From Prelims to Interview, we've got you covered.
          </p>

          {/* Developer credit */}
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">Developed by</p>
            <img src={fiveuLogo} alt="FiveU Vector Technologies" className="h-6 rounded object-contain" />
          </div>
          
          {/* Copyright */}
          <p className="text-xs text-muted-foreground mt-2">
            © {new Date().getFullYear()} UPSC Mentor. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
