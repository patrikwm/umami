/**
 * Tests for @/lib/crypto
 * Encryption, hashing, and UUID generation utilities
 */

import { decrypt, encrypt, hash, md5, uuid } from '@/lib/crypto';

describe('crypto', () => {
  describe('encrypt/decrypt', () => {
    const secret = 'test-secret-key-for-encryption';

    test('round-trip encryption and decryption', () => {
      const plaintext = 'sensitive data';
      const encrypted = encrypt(plaintext, secret);
      const decrypted = decrypt(encrypted, secret);

      expect(decrypted).toBe(plaintext);
    });

    test('produces different ciphertexts for same plaintext', () => {
      const plaintext = 'same message';
      const encrypted1 = encrypt(plaintext, secret);
      const encrypted2 = encrypt(plaintext, secret);

      // Different IVs and salts should produce different ciphertexts
      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to same value
      expect(decrypt(encrypted1, secret)).toBe(plaintext);
      expect(decrypt(encrypted2, secret)).toBe(plaintext);
    });

    test('decryption fails with wrong secret', () => {
      const plaintext = 'secret message';
      const encrypted = encrypt(plaintext, secret);

      expect(() => {
        decrypt(encrypted, 'wrong-secret-key');
      }).toThrow();
    });

    test('encrypts and decrypts empty string', () => {
      const plaintext = '';
      const encrypted = encrypt(plaintext, secret);
      const decrypted = decrypt(encrypted, secret);

      expect(decrypted).toBe('');
    });

    test('encrypts and decrypts long strings', () => {
      const plaintext = 'a'.repeat(10000);
      const encrypted = encrypt(plaintext, secret);
      const decrypted = decrypt(encrypted, secret);

      expect(decrypted).toBe(plaintext);
    });

    test('encrypts and decrypts UTF-8 characters', () => {
      const plaintext = 'Hello 世界 🌍 Ñoño';
      const encrypted = encrypt(plaintext, secret);
      const decrypted = decrypt(encrypted, secret);

      expect(decrypted).toBe(plaintext);
    });

    test('encrypts and decrypts numbers', () => {
      const plaintext = 12345;
      const encrypted = encrypt(plaintext, secret);
      const decrypted = decrypt(encrypted, secret);

      expect(decrypted).toBe('12345'); // Converted to string
    });

    test('encrypts and decrypts JSON', () => {
      const plaintext = JSON.stringify({ key: 'value', nested: { data: 123 } });
      const encrypted = encrypt(plaintext, secret);
      const decrypted = decrypt(encrypted, secret);

      expect(JSON.parse(decrypted)).toEqual({ key: 'value', nested: { data: 123 } });
    });

    test('produces base64 encoded output', () => {
      const plaintext = 'test';
      const encrypted = encrypt(plaintext, secret);

      // Base64 pattern
      expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });
  });

  describe('hash', () => {
    test('produces sha512 hash', () => {
      const result = hash('test');

      // SHA-512 hex digest is 128 characters
      expect(result).toHaveLength(128);
      expect(result).toMatch(/^[a-f0-9]{128}$/);
    });

    test('produces consistent output for same input', () => {
      const input = 'consistent';
      const hash1 = hash(input);
      const hash2 = hash(input);

      expect(hash1).toBe(hash2);
    });

    test('produces different hashes for different inputs', () => {
      const hash1 = hash('input1');
      const hash2 = hash('input2');

      expect(hash1).not.toBe(hash2);
    });

    test('handles multiple arguments joined together', () => {
      const hashMultiple = hash('part1', 'part2', 'part3');
      const hashSingle = hash('part1part2part3');

      expect(hashMultiple).toBe(hashSingle);
    });

    test('handles empty string', () => {
      const result = hash('');

      expect(result).toHaveLength(128);
      expect(result).toMatch(/^[a-f0-9]{128}$/);
    });

    test('handles UTF-8 characters', () => {
      const result = hash('Hello 世界 🌍');

      expect(result).toHaveLength(128);
      expect(result).toMatch(/^[a-f0-9]{128}$/);
    });

    test('is case-sensitive', () => {
      const hash1 = hash('Test');
      const hash2 = hash('test');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('md5', () => {
    test('produces md5 hash', () => {
      const result = md5('test');

      // MD5 hex digest is 32 characters
      expect(result).toHaveLength(32);
      expect(result).toMatch(/^[a-f0-9]{32}$/);
    });

    test('produces consistent output for same input', () => {
      const input = 'consistent';
      const hash1 = md5(input);
      const hash2 = md5(input);

      expect(hash1).toBe(hash2);
    });

    test('produces different hashes for different inputs', () => {
      const hash1 = md5('input1');
      const hash2 = md5('input2');

      expect(hash1).not.toBe(hash2);
    });

    test('handles multiple arguments joined together', () => {
      const hashMultiple = md5('part1', 'part2', 'part3');
      const hashSingle = md5('part1part2part3');

      expect(hashMultiple).toBe(hashSingle);
    });
  });

  describe('uuid', () => {
    test('generates valid UUID v4 format', () => {
      const id = uuid();

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[45][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    test('generates unique UUIDs on each call', () => {
      const id1 = uuid();
      const id2 = uuid();
      const id3 = uuid();

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    test('generates deterministic UUID v5 when arguments provided', () => {
      const id1 = uuid('namespace', 'value');
      const id2 = uuid('namespace', 'value');

      // Same inputs produce same UUID
      expect(id1).toBe(id2);
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    test('generates different UUID v5 for different arguments', () => {
      const id1 = uuid('namespace', 'value1');
      const id2 = uuid('namespace', 'value2');

      expect(id1).not.toBe(id2);
    });

    test('UUID v5 includes secret in hashing', () => {
      // Even same args should produce different UUID if secret changes
      // This test verifies deterministic behavior with same secret
      const id1 = uuid('test');
      const id2 = uuid('test');

      expect(id1).toBe(id2); // Deterministic with same secret
    });

    test('handles empty arguments for v5', () => {
      const id = uuid('');

      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    test('handles multiple arguments for v5', () => {
      const id = uuid('part1', 'part2', 'part3');

      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });
});
