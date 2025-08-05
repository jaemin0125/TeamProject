package com.example.demo.config;



import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // 모든 보안 기능 일시적 비활성화 (개발/문제 진단용)
            // 주의: 실제 프로덕션 환경에서는 절대 이렇게 사용하면 안 됩니다!
            .csrf(csrf -> csrf.disable()) // CSRF 비활성화
            .authorizeHttpRequests(authorize -> authorize
                .anyRequest().permitAll() // 모든 요청 허용
            );
            // .cors(cors -> cors.disable()); // 만약 CORS 문제도 의심된다면 이것도 활성화 해볼 수 있습니다.
            // .headers(headers -> headers.frameOptions().disable()); // H2 Console 등 사용 시 필요 (선택 사항)

        return http.build();
    }
}