// Initialize AOS with custom settings
AOS.init({
    duration: 800,
    offset: 50,
    once: true,
    easing: 'ease-out-cubic'
});

// Initialize Swiper with modern settings
const swiper = new Swiper('.swiper', {
    slidesPerView: 1,
    spaceBetween: 30,
    loop: true,
    autoplay: {
        delay: 5000,
        disableOnInteraction: false,
    },
    pagination: {
        el: '.swiper-pagination',
        clickable: true,
    },
    breakpoints: {
        640: {
            slidesPerView: 2,
            spaceBetween: 20,
        },
        1024: {
            slidesPerView: 3,
            spaceBetween: 30,
        },
    }
});

// Smooth scroll with offset
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        const headerOffset = 80;
        const elementPosition = target.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    });
});

// Navbar scroll effect with debounce
let lastScroll = 0;
const navbar = document.querySelector('.navbar');

const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

const handleScroll = debounce(() => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll <= 0) {
        navbar.classList.remove('scrolled');
        return;
    }
    
    if (currentScroll > lastScroll) {
        navbar.style.transform = 'translateY(-100%)';
    } else {
        navbar.style.transform = 'translateY(0)';
        navbar.classList.add('scrolled');
    }
    
    lastScroll = currentScroll;
}, 100);

window.addEventListener('scroll', handleScroll);

// Typing effect with cursor
const typingText = document.querySelector('.typing-text');
if (typingText) {
    const text = typingText.textContent;
    typingText.textContent = '';
    let i = 0;
    
    const typeWriter = () => {
        if (i < text.length) {
            typingText.textContent += text.charAt(i);
            i++;
            setTimeout(typeWriter, 50);
        } else {
            typingText.classList.add('typing-done');
        }
    };
    
    typeWriter();
}

// Counter animation with easing
const counters = document.querySelectorAll('.counter');
const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const counter = entry.target;
            const target = parseInt(counter.getAttribute('data-target'));
            let count = 0;
            const duration = 2000;
            const startTime = performance.now();
            
            const easeOutExpo = x => {
                return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
            };
            
            const updateCounter = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easedProgress = easeOutExpo(progress);
                
                count = Math.floor(target * easedProgress);
                counter.textContent = count.toLocaleString();
                
                if (progress < 1) {
                    requestAnimationFrame(updateCounter);
                } else {
                    counter.textContent = target.toLocaleString();
                }
            };
            
            requestAnimationFrame(updateCounter);
            counterObserver.unobserve(counter);
        }
    });
}, { threshold: 0.5 });

counters.forEach(counter => counterObserver.observe(counter));

// Form validation with custom messages
const forms = document.querySelectorAll('.needs-validation');
Array.from(forms).forEach(form => {
    form.addEventListener('submit', event => {
        if (!form.checkValidity()) {
            event.preventDefault();
            event.stopPropagation();
            
            // Add custom validation messages
            const inputs = form.querySelectorAll('input, textarea');
            inputs.forEach(input => {
                if (!input.checkValidity()) {
                    const feedback = input.nextElementSibling;
                    if (feedback && feedback.classList.contains('invalid-feedback')) {
                        feedback.textContent = input.validationMessage;
                    }
                }
            });
        }
        form.classList.add('was-validated');
    }, false);
});

// Dark mode toggle with system preference
const darkModeToggle = document.querySelector('.dark-mode-toggle');
const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

const setDarkMode = (isDark) => {
    document.body.classList.toggle('dark-mode', isDark);
    const icon = darkModeToggle.querySelector('i');
    icon.classList.toggle('fa-moon', !isDark);
    icon.classList.toggle('fa-sun', isDark);
    localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
};

if (darkModeToggle) {
    darkModeToggle.addEventListener('click', () => {
        const isDark = !document.body.classList.contains('dark-mode');
        setDarkMode(isDark);
    });
    
    // Check for saved preference or system preference
    const savedPreference = localStorage.getItem('darkMode');
    if (savedPreference) {
        setDarkMode(savedPreference === 'enabled');
    } else {
        setDarkMode(prefersDarkScheme.matches);
    }
}

// Loading animation with progress
window.addEventListener('load', () => {
    const loader = document.querySelector('.loader');
    if (loader) {
        loader.classList.add('hidden');
        setTimeout(() => {
            loader.style.display = 'none';
        }, 500);
    }
});

// Add hover effects to cards with parallax
document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = (y - centerY) / 10;
        const rotateY = (centerX - x) / 10;
        
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;
    });
    
    card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
    });
});

// Add animation classes to elements with delay
document.querySelectorAll('.hero-content h1').forEach(el => {
    el.classList.add('animate__animated', 'animate__fadeInDown');
});

document.querySelectorAll('.hero-content p').forEach(el => {
    el.classList.add('animate__animated', 'animate__fadeInUp');
});

document.querySelectorAll('.card').forEach((el, index) => {
    el.classList.add('animate__animated', 'animate__fadeInUp');
    el.style.animationDelay = `${index * 0.1}s`;
});

// Add scroll reveal animations with custom threshold
const revealElements = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            revealObserver.unobserve(entry.target);
        }
    });
}, { 
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
});

revealElements.forEach(el => revealObserver.observe(el)); 