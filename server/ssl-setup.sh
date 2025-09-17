#!/bin/bash

# SSL Certificate Setup Script for Remote Proxy Manager
# This script helps generate and manage SSL certificates for the proxy manager

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="proxyproxyconf.api.dashrdp.cloud"
EMAIL="dashrdp@gmail.com"
SSL_DIR="./ssl"
CERT_METHOD=""

# Functions
print_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --domain DOMAIN          Domain name for the certificate"
    echo "  --email EMAIL            Email for Let's Encrypt registration"
    echo "  --method METHOD          Certificate method: letsencrypt, selfsigned, or cloudflare"
    echo "  --help                   Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --domain example.com --email admin@example.com --method letsencrypt"
    echo "  $0 --domain localhost --method selfsigned"
    echo "  $0 --domain example.com --method cloudflare"
}

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v openssl &> /dev/null; then
        log_error "OpenSSL is required but not installed"
        exit 1
    fi
    
    if [ "$CERT_METHOD" = "letsencrypt" ] && ! command -v certbot &> /dev/null; then
        log_error "Certbot is required for Let's Encrypt certificates"
        log_info "Install with: sudo apt-get install certbot"
        exit 1
    fi
}

setup_ssl_directory() {
    log_info "Setting up SSL directory..."
    mkdir -p "$SSL_DIR"
    chmod 755 "$SSL_DIR"
}

generate_letsencrypt_cert() {
    log_info "Generating Let's Encrypt certificate for $DOMAIN..."
    
    if [ -z "$EMAIL" ]; then
        log_error "Email is required for Let's Encrypt certificates"
        exit 1
    fi
    
    # Check if running as root or with sudo
    if [ "$EUID" -ne 0 ]; then
        log_warn "Let's Encrypt certificate generation typically requires root privileges"
        log_info "You may need to run this script with sudo"
    fi
    
    # Generate certificate using standalone method
    certbot certonly --standalone \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL" \
        -d "$DOMAIN"
    
    # Copy certificates to SSL directory
    if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
        cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$SSL_DIR/cert.pem"
        cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$SSL_DIR/key.pem"
        chmod 644 "$SSL_DIR/cert.pem"
        chmod 600 "$SSL_DIR/key.pem"
        log_info "Let's Encrypt certificates copied to $SSL_DIR"
    else
        log_error "Failed to generate Let's Encrypt certificate"
        exit 1
    fi
}

generate_selfsigned_cert() {
    log_info "Generating self-signed certificate for $DOMAIN..."
    
    # Generate private key
    openssl genrsa -out "$SSL_DIR/key.pem" 4096
    
    # Generate certificate
    openssl req -new -x509 -key "$SSL_DIR/key.pem" -out "$SSL_DIR/cert.pem" -days 365 \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN"
    
    # Set proper permissions
    chmod 644 "$SSL_DIR/cert.pem"
    chmod 600 "$SSL_DIR/key.pem"
    
    log_info "Self-signed certificate generated for $DOMAIN"
    log_warn "Self-signed certificates are not trusted by default"
    log_warn "You'll need to accept the certificate in your browser"
}

setup_cloudflare_cert() {
    log_info "Setting up CloudFlare origin certificate..."
    log_info "Please follow these steps:"
    echo ""
    echo "1. Log into CloudFlare dashboard"
    echo "2. Go to SSL/TLS > Origin Server"
    echo "3. Click 'Create Certificate'"
    echo "4. Select 'Let CloudFlare generate a private key and a CSR'"
    echo "5. Add your domain: $DOMAIN"
    echo "6. Choose key type: RSA (2048)"
    echo "7. Copy the certificate to: $SSL_DIR/cert.pem"
    echo "8. Copy the private key to: $SSL_DIR/key.pem"
    echo ""
    
    # Create placeholder files
    touch "$SSL_DIR/cert.pem"
    touch "$SSL_DIR/key.pem"
    chmod 644 "$SSL_DIR/cert.pem"
    chmod 600 "$SSL_DIR/key.pem"
    
    log_warn "Please manually add your CloudFlare origin certificate and private key"
    log_warn "Files created: $SSL_DIR/cert.pem and $SSL_DIR/key.pem"
}

verify_certificate() {
    log_info "Verifying certificate..."
    
    if [ ! -f "$SSL_DIR/cert.pem" ] || [ ! -f "$SSL_DIR/key.pem" ]; then
        log_error "Certificate files not found"
        return 1
    fi
    
    # Check certificate validity
    if openssl x509 -in "$SSL_DIR/cert.pem" -noout -checkend 86400; then
        log_info "Certificate is valid"
    else
        log_warn "Certificate is expiring within 24 hours or is invalid"
    fi
    
    # Show certificate details
    log_info "Certificate details:"
    openssl x509 -in "$SSL_DIR/cert.pem" -noout -subject -dates -issuer
}

update_nginx_config() {
    log_info "Updating Nginx configuration..."
    
    if [ -f "nginx.conf" ]; then
        # Update domain in nginx.conf
        sed -i "s/server_name .*/server_name $DOMAIN;/g" nginx.conf
        log_info "Updated domain in nginx.conf to $DOMAIN"
    else
        log_warn "nginx.conf not found, skipping configuration update"
    fi
}

create_renewal_script() {
    if [ "$CERT_METHOD" = "letsencrypt" ]; then
        log_info "Creating certificate renewal script..."
        
        cat > "$SSL_DIR/renew-cert.sh" << EOF
#!/bin/bash
# Let's Encrypt certificate renewal script

set -e

DOMAIN="$DOMAIN"
SSL_DIR="$SSL_DIR"

echo "Renewing Let's Encrypt certificate for \$DOMAIN..."

# Renew certificate
certbot renew --force-renewal

# Copy renewed certificates
cp "/etc/letsencrypt/live/\$DOMAIN/fullchain.pem" "\$SSL_DIR/cert.pem"
cp "/etc/letsencrypt/live/\$DOMAIN/privkey.pem" "\$SSL_DIR/key.pem"
chmod 644 "\$SSL_DIR/cert.pem"
chmod 600 "\$SSL_DIR/key.pem"

echo "Certificate renewed successfully"

# Restart nginx container if running
if docker compose ps nginx | grep -q "Up"; then
    echo "Restarting nginx container..."
    docker compose restart nginx
fi
EOF

        chmod +x "$SSL_DIR/renew-cert.sh"
        log_info "Renewal script created: $SSL_DIR/renew-cert.sh"
        log_info "Add to crontab for automatic renewal:"
        log_info "0 3 * * * $PWD/$SSL_DIR/renew-cert.sh"
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --domain)
            DOMAIN="$2"
            shift 2
            ;;
        --email)
            EMAIL="$2"
            shift 2
            ;;
        --method)
            CERT_METHOD="$2"
            shift 2
            ;;
        --help)
            print_usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            print_usage
            exit 1
            ;;
    esac
done

# Validate required parameters
if [ -z "$DOMAIN" ]; then
    log_error "Domain is required"
    print_usage
    exit 1
fi

if [ -z "$CERT_METHOD" ]; then
    log_error "Certificate method is required"
    print_usage
    exit 1
fi

# Validate certificate method
case $CERT_METHOD in
    letsencrypt|selfsigned|cloudflare)
        ;;
    *)
        log_error "Invalid certificate method: $CERT_METHOD"
        log_error "Valid methods: letsencrypt, selfsigned, cloudflare"
        exit 1
        ;;
esac

# Main execution
log_info "Starting SSL certificate setup for $DOMAIN using $CERT_METHOD method"

check_dependencies
setup_ssl_directory

case $CERT_METHOD in
    letsencrypt)
        generate_letsencrypt_cert
        ;;
    selfsigned)
        generate_selfsigned_cert
        ;;
    cloudflare)
        setup_cloudflare_cert
        ;;
esac

if [ "$CERT_METHOD" != "cloudflare" ]; then
    verify_certificate
fi

update_nginx_config
create_renewal_script

log_info "SSL certificate setup completed!"
log_info "Certificate files:"
log_info "  - Certificate: $SSL_DIR/cert.pem"
log_info "  - Private key: $SSL_DIR/key.pem"
log_info ""
log_info "Next steps:"
log_info "1. Start the production services: docker compose --profile production up -d"
log_info "2. Test the HTTPS endpoint: curl -I https://$DOMAIN/api/health"
log_info "3. Update Chrome extension with HTTPS URL: https://$DOMAIN"
