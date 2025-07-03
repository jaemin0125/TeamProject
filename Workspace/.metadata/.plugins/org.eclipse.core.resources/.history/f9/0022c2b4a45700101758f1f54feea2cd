package com.example.demo.dto;

import lombok.AllArgsConstructor;
// import lombok.Data; // <-- 이 줄을 제거합니다!
import lombok.NoArgsConstructor;

@NoArgsConstructor // 기본 생성자
@AllArgsConstructor // 모든 필드를 포함하는 생성자
public class AnimationState {
    private boolean isWalking;
    private boolean isBackward;
    private boolean isLeft;
    private boolean isRight;
    private boolean isJumping;
    private boolean isRunning;
    private boolean isSitted;
    private boolean isSittedAndWalk;
    private boolean isLyingDown;
    private boolean isLyingDownAndWalk;
    private boolean isPunching;
    private boolean isHitted;
    private boolean isIdle;

    // 모든 getter를 수동으로 정의합니다 (getIsXxx 형태)
    public boolean getIsWalking() { return isWalking; }
    public void setIsWalking(boolean isWalking) { this.isWalking = isWalking; } // setter도 추가

    public boolean getIsBackward() { return isBackward; }
    public void setIsBackward(boolean isBackward) { this.isBackward = isBackward; }

    public boolean getIsLeft() { return isLeft; }
    public void setIsLeft(boolean isLeft) { this.isLeft = isLeft; }

    public boolean getIsRight() { return isRight; }
    public void setIsRight(boolean isRight) { this.isRight = isRight; }

    public boolean getIsJumping() { return isJumping; }
    public void setIsJumping(boolean isJumping) { this.isJumping = isJumping; }

    public boolean getIsRunning() { return isRunning; }
    public void setIsRunning(boolean isRunning) { this.isRunning = isRunning; }

    public boolean getIsSitted() { return isSitted; }
    public void setIsSitted(boolean isSitted) { this.isSitted = isSitted; }

    public boolean getIsSittedAndWalk() { return isSittedAndWalk; }
    public void setIsSittedAndWalk(boolean isSittedAndWalk) { this.isSittedAndWalk = isSittedAndWalk; }

    public boolean getIsLyingDown() { return isLyingDown; }
    public void setIsLyingDown(boolean isLyingDown) { this.isLyingDown = isLyingDown; }

    public boolean getIsLyingDownAndWalk() { return isLyingDownAndWalk; }
    public void setIsLyingDownAndWalk(boolean isLyingDownAndWalk) { this.isLyingDownAndWalk = isLyingDownAndWalk; }

    public boolean getIsPunching() { return isPunching; }
    public void setIsPunching(boolean isPunching) { this.isPunching = isPunching; }
    
    public boolean getIsHitted() { return isHitted; }
    public void setIsHitted(boolean isHitted) { this.isHitted = isHitted; }

    public boolean getIsIdle() { return isIdle; }
    public void setIsIdle(boolean isIdle) { this.isIdle = isIdle; }

    // toString() 메서드를 수동으로 오버라이드하여 로그에서 보기 좋게 만듭니다.
    @Override
    public String toString() {
        return "AnimationState{" +
               "isWalking=" + isWalking +
               ", isBackward=" + isBackward +
               ", isLeft=" + isLeft +
               ", isRight=" + isRight +
               ", isJumping=" + isJumping +
               ", isRunning=" + isRunning + 
               ", isSitted=" + isSitted +
               ", isSittedAndWalk=" + isSittedAndWalk +
               ", isLyingDown=" + isLyingDown +
               ", isLyingDownAndWalk=" + isLyingDownAndWalk +
               ", isPunching=" + isPunching +
               ", isHitted=" + isHitted +
               ", isIdle=" + isIdle +
               '}';
    }
}