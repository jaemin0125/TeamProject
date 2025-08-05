package com.example.demo.config;


import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

 @Override
 public void addCorsMappings(CorsRegistry registry) {
     registry.addMapping("/**") // 모든 경로에 대해 CORS 허용
             .allowedOrigins("http://localhost:5173") // Vite 개발 서버의 주소 (프론트엔드 주소)
             .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS") // 허용할 HTTP 메서드
             .allowedHeaders("*") // 모든 헤더 허용
             .allowCredentials(true); // 자격 증명 (쿠키, HTTP 인증 등) 허용
 }
}