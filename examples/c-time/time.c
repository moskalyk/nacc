#include <stdio.h>
#include <string.h>
#include <time.h>
#include <stdint.h>
#include <secp256k1.h>

#include <stdint.h>
#include <string.h>

#define KECCAK_ROUNDS 24
typedef uint64_t u64;
typedef uint8_t u8;

// Keccak round constants
const u64 keccakf_rndc[KECCAK_ROUNDS] = {
    0x0000000000000001ULL, 0x0000000000008082ULL, 0x800000000000808aULL,
    0x8000000080008000ULL, 0x000000000000808bULL, 0x0000000080000001ULL,
    0x8000000080008081ULL, 0x8000000000008009ULL, 0x000000000000008aULL,
    0x0000000000000088ULL, 0x0000000080008009ULL, 0x000000008000000aULL,
    0x000000008000808bULL, 0x800000000000008bULL, 0x8000000000008089ULL,
    0x8000000000008003ULL, 0x8000000000008002ULL, 0x8000000000000080ULL,
    0x000000000000800aULL, 0x800000008000000aULL, 0x8000000080008081ULL,
    0x8000000000008080ULL, 0x0000000080000001ULL, 0x8000000080008008ULL};

// Rotation constants for Keccak
const int keccakf_rotc[24] = {1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14,
                              27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44};

// Pi permutation for Keccak
const int keccakf_piln[24] = {10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4,
                              15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1};

// Keccak-f[1600] state permutation
void keccakf(u64 st[25]) {
    int i, j, r;
    u64 t, bc[5];

    for (r = 0; r < KECCAK_ROUNDS; r++) {
        // Theta step
        for (i = 0; i < 5; i++)
            bc[i] = st[i] ^ st[i + 5] ^ st[i + 10] ^ st[i + 15] ^ st[i + 20];
        for (i = 0; i < 5; i++) {
            t = bc[(i + 4) % 5] ^ ((bc[(i + 1) % 5] << 1) | (bc[(i + 1) % 5] >> (64 - 1)));
            for (j = 0; j < 25; j += 5)
                st[j + i] ^= t;
        }

        // Rho Pi step
        t = st[1];
        for (i = 0; i < 24; i++) {
            j = keccakf_piln[i];
            bc[0] = st[j];
            st[j] = (t << keccakf_rotc[i]) | (t >> (64 - keccakf_rotc[i]));
            t = bc[0];
        }

        // Chi step
        for (j = 0; j < 25; j += 5) {
            for (i = 0; i < 5; i++)
                bc[i] = st[j + i];
            for (i = 0; i < 5; i++)
                st[j + i] ^= (~bc[(i + 1) % 5]) & bc[(i + 2) % 5];
        }

        // Iota step
        st[0] ^= keccakf_rndc[r];
    }
}

// Keccak padding and input processing
void keccak(const u8 *in, int inlen, u8 *md, int mdlen) {
    u64 st[25];
    u8 temp[144];
    int i, rsiz, rsizw;

    memset(st, 0, sizeof(st));

    rsiz = 200 - 2 * mdlen;
    rsizw = rsiz / 8;

    for (; inlen >= rsiz; inlen -= rsiz, in += rsiz) {
        for (i = 0; i < rsizw; i++)
            st[i] ^= ((u64 *) in)[i];
        keccakf(st);
    }

    memcpy(temp, in, inlen);
    temp[inlen++] = 1;
    memset(temp + inlen, 0, rsiz - inlen);
    temp[rsiz - 1] |= 0x80;

    for (i = 0; i < rsizw; i++)
        st[i] ^= ((u64 *) temp)[i];

    keccakf(st);

    for (i = 0; i < mdlen / 8; i++)
        ((u64 *) md)[i] = st[i];
}

// Keccak-256 hash function
void keccak_256(const u8 *in, int inlen, u8 *md) {
    keccak(in, inlen, md, 32);  // Keccak-256 produces a 32-byte (256-bit) hash
}


// Function to get the current system time and timezone as a string
void get_current_time_and_timezone(char *time_str, size_t size) {
    time_t current_time = time(NULL);
    struct tm *tm_info = localtime(&current_time);

    // Get the current timezone offset in seconds
    char timezone_str[6];
    strftime(timezone_str, sizeof(timezone_str), "%z", tm_info);

    // Format the time and timezone into the provided buffer
    strftime(time_str, size - strlen(timezone_str), "%Y-%m-%d %H:%M:%S", tm_info);
    strcat(time_str, " ");
    strcat(time_str, timezone_str);  // Append timezone
}

// Function to sign a Keccak-256 hashed message using secp256k1
int sign_message(const unsigned char *hash, size_t hash_len, const unsigned char *private_key, unsigned char *signature, size_t *signature_len) {
    secp256k1_context *ctx = secp256k1_context_create(SECP256K1_CONTEXT_SIGN);
    secp256k1_ecdsa_signature sig;

    // Sign the Keccak-256 hash using the private key
    if (!secp256k1_ecdsa_sign(ctx, &sig, hash, private_key, NULL, NULL)) {
        fprintf(stderr, "Error signing the message\n");
        secp256k1_context_destroy(ctx);
        return 0;
    }

    // Serialize the signature in compact format (64 bytes)
    secp256k1_ecdsa_signature_serialize_compact(ctx, signature, &sig);

    secp256k1_context_destroy(ctx);
    *signature_len = 64;  // secp256k1 signature size is 64 bytes in compact form
    return 1;
}

// Function to print a hex-encoded signature or message
void print_hex(const char *label, const unsigned char *data, size_t len) {
    printf("%s: ", label);
    for (size_t i = 0; i < len; i++) {
        printf("%02x", data[i]);
    }
    printf("\n");
}

int main() {
    // Example secp256k1 private key (replace with your actual private key)
    unsigned char private_key[32] = {
        0x4c, 0x88, 0xb6, 0xa7, 0xf3, 0xd9, 0xc6, 0xa1,
        0x12, 0x75, 0x2c, 0xb3, 0x3f, 0xf3, 0xc9, 0x4c,
        0xc2, 0xe4, 0xd6, 0x6f, 0x63, 0xb8, 0x64, 0xa4,
        0x39, 0x74, 0x49, 0xf0, 0xb9, 0xe1, 0x76, 0x60
    };

    // Step 1: Get the current time and timezone as a string
    char time_message[256];
    get_current_time_and_timezone(time_message, sizeof(time_message));
    printf("Current system time and timezone: %s\n", time_message);

    // Print the message to be hashed
    printf("Message to be hashed: %s\n", time_message);

    // Step 2: Hash the message using Keccak-256
    unsigned char hash[32];
    keccak_256((unsigned char *)time_message, strlen(time_message), hash);
    print_hex("Keccak-256 Hash", hash, 32);

    // Step 3: Sign the hashed message using secp256k1
    unsigned char signature[64];
    size_t signature_len = 0;
    if (!sign_message(hash, sizeof(hash), private_key, signature, &signature_len)) {
        fprintf(stderr, "Error signing the message\n");
        return 1;
    }

    // Print the signature
    print_hex("Signature", signature, signature_len);

    return 0;
}
