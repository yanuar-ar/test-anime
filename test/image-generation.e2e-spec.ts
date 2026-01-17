/**
 * ============================================================================
 * FILE: image-generation.e2e-spec.ts
 * ============================================================================
 *
 * File ini berisi Integration Test (End-to-End Test) untuk ImageGenerationController.
 *
 * APA ITU INTEGRATION TEST?
 * - Test yang menguji keseluruhan alur aplikasi dari request HTTP hingga response
 * - Berbeda dengan unit test yang hanya menguji satu fungsi/method secara terisolasi
 * - Memastikan semua komponen (controller, service, validation) bekerja bersama dengan benar
 *
 * LIBRARY YANG DIGUNAKAN:
 * - Jest: Framework testing utama (describe, it, expect)
 * - Supertest: Library untuk melakukan HTTP request ke aplikasi NestJS
 * - @nestjs/testing: Utility untuk membuat aplikasi NestJS dalam mode testing
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ============================================================================
 * DESCRIBE BLOCK UTAMA
 * ============================================================================
 *
 * describe() = Mengelompokkan test cases yang berhubungan
 * 'ImageGenerationController (e2e)' = Nama grup test ini
 */
describe('ImageGenerationController (e2e)', () => {
  /**
   * Variabel untuk menyimpan instance aplikasi NestJS
   * INestApplication = Interface yang merepresentasikan aplikasi NestJS yang sudah berjalan
   */
  let app: INestApplication<App>;

  /**
   * Path ke folder tempat gambar hasil generate disimpan
   * process.cwd() = direktori kerja saat ini (root project)
   */
  const generatedImagesDir = path.join(process.cwd(), 'generated-images');

  /**
   * ==========================================================================
   * beforeAll() - SETUP SEBELUM SEMUA TEST DIJALANKAN
   * ==========================================================================
   *
   * Fungsi ini dijalankan SEKALI sebelum semua test case dalam describe block ini.
   * Digunakan untuk:
   * 1. Membuat instance aplikasi NestJS untuk testing
   * 2. Mengkonfigurasi ValidationPipe (untuk validasi DTO)
   * 3. Menginisialisasi aplikasi
   */
  beforeAll(async () => {
    // Membuat module testing dengan mengimpor AppModule (module utama aplikasi)
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // Membuat instance aplikasi NestJS dari module yang sudah dikompilasi
    app = moduleFixture.createNestApplication();

    /**
     * Mengkonfigurasi ValidationPipe global
     * - whitelist: true = Hanya menerima property yang didefinisikan di DTO
     * - forbidNonWhitelisted: true = Reject request jika ada property yang tidak dikenal
     * - transform: true = Otomatis transform tipe data (string "123" -> number 123)
     */
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    // Inisialisasi aplikasi (wajib dipanggil sebelum bisa menerima request)
    await app.init();
  });

  /**
   * ==========================================================================
   * afterAll() - CLEANUP SETELAH SEMUA TEST SELESAI
   * ==========================================================================
   *
   * Fungsi ini dijalankan SEKALI setelah semua test case selesai.
   * Digunakan untuk menutup koneksi dan membersihkan resource.
   */
  afterAll(async () => {
    await app.close();
  });

  /**
   * ==========================================================================
   * TEST GROUP: GET /api/images/styles
   * ==========================================================================
   *
   * Menguji endpoint untuk mendapatkan daftar style anime yang tersedia.
   */
  describe('GET /api/images/styles', () => {
    /**
     * TEST CASE: Harus mengembalikan daftar style anime
     *
     * it() = Mendefinisikan satu test case
     * Alur test:
     * 1. Kirim GET request ke /api/images/styles
     * 2. Expect status code 200 (OK)
     * 3. Expect response body memiliki property 'styles'
     * 4. Expect styles memiliki MODERN, GHIBLI, CHIBI
     */
    it('should return available anime styles', () => {
      return request(app.getHttpServer()) // Mendapatkan HTTP server dari aplikasi
        .get('/api/images/styles')        // Kirim GET request
        .expect(200)                       // Expect status 200
        .expect((res) => {
          // Validasi struktur response
          expect(res.body).toHaveProperty('styles');
          expect(res.body.styles).toHaveProperty('MODERN');
          expect(res.body.styles).toHaveProperty('GHIBLI');
          expect(res.body.styles).toHaveProperty('CHIBI');
        });
    });
  });

  /**
   * ==========================================================================
   * TEST GROUP: GET /api/images/aspect-ratios
   * ==========================================================================
   *
   * Menguji endpoint untuk mendapatkan daftar aspect ratio yang tersedia.
   */
  describe('GET /api/images/aspect-ratios', () => {
    /**
     * TEST CASE: Harus mengembalikan daftar aspect ratio
     *
     * Aspect ratio = perbandingan lebar dan tinggi gambar
     * - SQUARE = 1:1 (kotak)
     * - PORTRAIT = 9:16 (vertikal/potrait)
     * - LANDSCAPE = 16:9 (horizontal/landscape)
     */
    it('should return available aspect ratios', () => {
      return request(app.getHttpServer())
        .get('/api/images/aspect-ratios')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('aspectRatios');
          expect(res.body.aspectRatios).toHaveProperty('SQUARE');
          expect(res.body.aspectRatios).toHaveProperty('PORTRAIT');
          expect(res.body.aspectRatios).toHaveProperty('LANDSCAPE');
        });
    });
  });

  /**
   * ==========================================================================
   * TEST GROUP: POST /api/images/generate
   * ==========================================================================
   *
   * Menguji endpoint utama untuk generate gambar anime.
   * Ini adalah endpoint yang memanggil Google Gemini AI.
   *
   * Group ini berisi:
   * - Test validasi input (negative test cases)
   * - Test generate gambar sukses (positive test cases)
   */
  describe('POST /api/images/generate', () => {
    /**
     * TEST CASE: Harus reject request tanpa prompt
     *
     * Ini adalah NEGATIVE TEST - menguji bahwa aplikasi menolak input yang tidak valid.
     * Prompt adalah field wajib, jadi request tanpa prompt harus ditolak dengan status 400.
     */
    it('should reject request without prompt', () => {
      return request(app.getHttpServer())
        .post('/api/images/generate')
        .send({})                          // Kirim body kosong (tanpa prompt)
        .expect(400)                       // Expect status 400 (Bad Request)
        .expect((res) => {
          // Pastikan pesan error menyebutkan bahwa prompt tidak boleh kosong
          expect(res.body.message).toContain('prompt should not be empty');
        });
    });

    /**
     * TEST CASE: Harus reject request dengan prompt kosong
     *
     * Berbeda dengan test sebelumnya, ini mengirim prompt tapi isinya string kosong.
     * Hasil harus sama: ditolak dengan status 400.
     */
    it('should reject request with empty prompt', () => {
      return request(app.getHttpServer())
        .post('/api/images/generate')
        .send({ prompt: '' })              // Prompt ada tapi kosong
        .expect(400);
    });

    /**
     * TEST CASE: Harus reject style yang tidak valid
     *
     * Style harus salah satu dari enum yang didefinisikan (MODERN, GHIBLI, dll).
     * Jika user mengirim style yang tidak dikenal, harus ditolak.
     */
    it('should reject invalid style', () => {
      return request(app.getHttpServer())
        .post('/api/images/generate')
        .send({
          prompt: 'a cute cat',
          style: 'invalid_style',          // Style tidak valid
        })
        .expect(400);
    });

    /**
     * TEST CASE: Harus reject aspect ratio yang tidak valid
     *
     * Aspect ratio harus salah satu dari: SQUARE, PORTRAIT, LANDSCAPE, dll.
     * Nilai random harus ditolak.
     */
    it('should reject invalid aspect ratio', () => {
      return request(app.getHttpServer())
        .post('/api/images/generate')
        .send({
          prompt: 'a cute cat',
          aspectRatio: 'invalid_ratio',    // Aspect ratio tidak valid
        })
        .expect(400);
    });

    /**
     * TEST CASE: Harus reject property yang tidak dikenal
     *
     * Karena kita menggunakan forbidNonWhitelisted: true di ValidationPipe,
     * property yang tidak didefinisikan di DTO akan ditolak.
     * Ini mencegah user mengirim data yang tidak diperlukan.
     */
    it('should reject unknown properties', () => {
      return request(app.getHttpServer())
        .post('/api/images/generate')
        .send({
          prompt: 'a cute cat',
          unknownField: 'value',           // Field tidak dikenal
        })
        .expect(400);
    });

    /**
     * TEST CASE: Harus berhasil generate gambar dengan prompt valid
     *
     * Ini adalah POSITIVE TEST - menguji alur sukses.
     * Test ini akan benar-benar memanggil Google Gemini AI untuk generate gambar.
     *
     * CATATAN:
     * - async/await digunakan karena kita perlu menunggu response
     * - Timeout 60000ms (60 detik) karena AI generation bisa lama
     * - Status 201 (Created) karena POST request yang membuat resource baru
     */
    it('should generate image with valid prompt', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/images/generate')
        .send({
          prompt: 'a cute anime cat girl with blue hair',
          style: 'modern anime style',
        })
        .expect(201);                      // 201 = Created (resource baru dibuat)

      // Validasi struktur response
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('base64');    // Gambar dalam format base64
      expect(response.body.data).toHaveProperty('mimeType');  // Tipe file (image/png, dll)
      expect(response.body.data).toHaveProperty('prompt');    // Prompt yang digunakan
      expect(response.body.data.base64).toBeTruthy();         // Pastikan base64 tidak kosong
    }, 60000); // Timeout 60 detik untuk API call ke Gemini

    /**
     * TEST CASE: Harus berhasil generate gambar dengan semua opsi
     *
     * Test ini menguji bahwa semua parameter opsional berfungsi:
     * - style: Gaya anime
     * - aspectRatio: Rasio gambar
     * - negativePrompt: Hal yang ingin dihindari dalam gambar
     */
    it('should generate image with all options', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/images/generate')
        .send({
          prompt: 'a samurai warrior',
          style: 'shonen anime style',
          aspectRatio: '16:9',
          negativePrompt: 'blurry, low quality',  // Hindari gambar blur dan kualitas rendah
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.base64).toBeTruthy();
    }, 60000);
  });

  /**
   * ==========================================================================
   * TEST GROUP: POST /api/images/generate-and-save
   * ==========================================================================
   *
   * Menguji endpoint untuk generate gambar DAN menyimpannya ke disk.
   * Berbeda dengan /generate yang hanya return base64, endpoint ini juga:
   * 1. Menyimpan file ke folder generated-images/
   * 2. Mengembalikan path file dan URL untuk akses
   */
  describe('POST /api/images/generate-and-save', () => {
    /**
     * TEST CASE: Harus generate dan menyimpan gambar ke disk
     *
     * Alur test:
     * 1. Kirim request untuk generate gambar
     * 2. Validasi response memiliki filePath dan url
     * 3. Verifikasi file benar-benar ada di disk
     * 4. Cleanup: hapus file setelah test (agar tidak menumpuk)
     */
    it('should generate and save image to disk', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/images/generate-and-save')
        .send({
          prompt: 'a magical forest with spirits',
          style: 'studio ghibli style',
        })
        .expect(201);

      // Validasi response
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('filePath');  // Path absolut ke file
      expect(response.body.data).toHaveProperty('url');       // URL relatif untuk akses

      // Verifikasi file benar-benar ada di disk
      const filePath = response.body.data.filePath;
      expect(fs.existsSync(filePath)).toBe(true);

      // Cleanup: Hapus file setelah test agar tidak menumpuk
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);  // unlinkSync = hapus file secara synchronous
      }
    }, 60000);
  });

  /**
   * ==========================================================================
   * TEST GROUP: GET /api/images/health
   * ==========================================================================
   *
   * Menguji endpoint health check untuk memeriksa status koneksi ke Gemini API.
   * Endpoint ini berguna untuk monitoring dan memastikan service siap menerima request.
   *
   * Response structure:
   * - status: 'healthy' | 'unhealthy'
   * - geminiApi: { connected: boolean, responseTimeMs?: number, error?: string }
   * - timestamp: ISO 8601 string
   */
  describe('GET /api/images/health', () => {
    /**
     * TEST CASE: Harus mengembalikan status 200
     *
     * Health check endpoint harus selalu return 200 OK,
     * baik ketika API healthy maupun unhealthy.
     * Status kesehatan ditentukan dari body response, bukan HTTP status code.
     */
    it('should return 200 status code', () => {
      return request(app.getHttpServer())
        .get('/api/images/health')
        .expect(200);
    });

    /**
     * TEST CASE: Response harus memiliki struktur yang benar
     *
     * Validasi bahwa response memiliki semua property yang diperlukan:
     * - status: Status keseluruhan health check
     * - geminiApi: Object yang berisi informasi koneksi ke Gemini API
     * - timestamp: Waktu pengecekan dalam format ISO
     */
    it('should have correct response structure', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/images/health')
        .expect(200);

      // Validasi property level pertama
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('geminiApi');
      expect(response.body).toHaveProperty('timestamp');

      // Validasi struktur geminiApi
      expect(response.body.geminiApi).toHaveProperty('connected');
    });

    /**
     * TEST CASE: Status harus 'healthy' atau 'unhealthy'
     *
     * Field status hanya boleh memiliki dua nilai:
     * - 'healthy': Semua komponen berfungsi dengan baik
     * - 'unhealthy': Ada masalah dengan salah satu komponen
     */
    it('should have valid status value (healthy or unhealthy)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/images/health')
        .expect(200);

      expect(['healthy', 'unhealthy']).toContain(response.body.status);
    });

    /**
     * TEST CASE: geminiApi.connected harus boolean
     *
     * Field connected menunjukkan apakah koneksi ke Gemini API berhasil.
     * Nilainya harus boolean (true/false), bukan string atau tipe lain.
     */
    it('should have boolean connected value in geminiApi', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/images/health')
        .expect(200);

      expect(typeof response.body.geminiApi.connected).toBe('boolean');
    });

    /**
     * TEST CASE: Timestamp harus dalam format ISO 8601
     *
     * Timestamp harus valid ISO 8601 string yang bisa di-parse oleh Date.
     * Contoh format: "2024-01-15T10:30:00.000Z"
     */
    it('should have valid ISO timestamp', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/images/health')
        .expect(200);

      const timestamp = response.body.timestamp;
      expect(typeof timestamp).toBe('string');

      // Validasi bahwa timestamp bisa di-parse sebagai Date yang valid
      const parsedDate = new Date(timestamp);
      expect(parsedDate.toString()).not.toBe('Invalid Date');

      // Validasi format ISO (harus bisa di-convert kembali ke ISO string yang sama)
      expect(timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
      );
    });

    /**
     * TEST CASE: Jika healthy, harus ada responseTimeMs
     *
     * Ketika status healthy dan connected true, response harus menyertakan
     * responseTimeMs yang menunjukkan waktu response dari Gemini API dalam milidetik.
     */
    it('should include responseTimeMs when connected', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/images/health')
        .expect(200);

      // Jika connected, responseTimeMs harus ada dan berupa number
      if (response.body.geminiApi.connected) {
        expect(response.body.geminiApi).toHaveProperty('responseTimeMs');
        expect(typeof response.body.geminiApi.responseTimeMs).toBe('number');
        expect(response.body.geminiApi.responseTimeMs).toBeGreaterThanOrEqual(0);
      }
    });

    /**
     * TEST CASE: Jika unhealthy, harus ada error message
     *
     * Ketika status unhealthy, response harus menyertakan pesan error
     * yang menjelaskan masalah yang terjadi.
     */
    it('should include error message when unhealthy', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/images/health')
        .expect(200);

      // Jika status unhealthy, error harus ada
      if (response.body.status === 'unhealthy') {
        expect(response.body.geminiApi).toHaveProperty('error');
        expect(typeof response.body.geminiApi.error).toBe('string');
      }
    });

    /**
     * TEST CASE: Health check dengan Gemini API tersedia
     *
     * Ini adalah positive test yang memverifikasi bahwa ketika Gemini API
     * berfungsi dengan baik, health check mengembalikan status healthy.
     * Test ini memiliki timeout lebih lama karena melakukan request ke API eksternal.
     */
    it('should return healthy status when Gemini API is available', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/images/health')
        .expect(200);

      // Jika Gemini API tersedia (API key valid dan service up)
      // status harus healthy dan connected harus true
      if (response.body.geminiApi.connected) {
        expect(response.body.status).toBe('healthy');
        expect(response.body.geminiApi.responseTimeMs).toBeGreaterThan(0);
      }
    }, 30000); // Timeout 30 detik untuk API call ke Gemini
  });

  /**
   * ==========================================================================
   * TEST GROUP: GET /api/images/:filename
   * ==========================================================================
   *
   * Menguji endpoint untuk mengambil/serve gambar yang sudah di-generate.
   * Endpoint ini seperti static file server untuk folder generated-images/.
   */
  describe('GET /api/images/:filename', () => {
    /**
     * TEST CASE: Harus return 404 untuk gambar yang tidak ada
     *
     * Jika user request gambar dengan filename yang tidak exist,
     * API harus return status 404 (Not Found) dengan pesan error yang jelas.
     */
    it('should return 404 for non-existent image', () => {
      return request(app.getHttpServer())
        .get('/api/images/non-existent-image.png')  // Filename yang tidak ada
        .expect(404)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.message).toBe('Image not found');
        });
    });

    /**
     * TEST CASE: Harus bisa serve gambar yang sudah ada
     *
     * Alur test:
     * 1. Generate dan simpan gambar terlebih dahulu
     * 2. Ambil filename dari response
     * 3. Request gambar menggunakan endpoint GET
     * 4. Validasi content-type adalah image/*
     * 5. Cleanup: hapus file
     *
     * Ini adalah INTEGRATION TEST yang menguji 2 endpoint sekaligus:
     * POST /generate-and-save -> GET /:filename
     */
    it('should serve existing image', async () => {
      // STEP 1: Generate dan simpan gambar
      const generateResponse = await request(app.getHttpServer())
        .post('/api/images/generate-and-save')
        .send({
          prompt: 'a simple anime flower',
        })
        .expect(201);

      // STEP 2: Extract filename dari path (contoh: /path/to/anime_123.png -> anime_123.png)
      const filename = path.basename(generateResponse.body.data.filePath);

      // STEP 3: Request gambar menggunakan GET endpoint
      const imageResponse = await request(app.getHttpServer())
        .get(`/api/images/${filename}`)
        .expect(200);

      // STEP 4: Validasi bahwa response adalah gambar (content-type: image/*)
      expect(imageResponse.headers['content-type']).toMatch(/^image\//);

      // STEP 5: Cleanup - hapus file setelah test
      const filePath = generateResponse.body.data.filePath;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }, 60000);
  });
});
