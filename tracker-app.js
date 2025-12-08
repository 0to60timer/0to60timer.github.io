// Tracker App - Optimized for mobile racing
class SpeedTracker {
  constructor() {
    // Settings
    this.darkMode = localStorage.getItem('darkMode') !== 'false'; // default true
    this.isMetric = localStorage.getItem('isMetric') === 'true'; // default false (mph)
    
    // State
    this.isRunning = false;
    this.isCalibrated = false;
    this.runStartTime = null;
    this.velocity = 0;
    this.distance = 0;
    this.lastTimestamp = 0;
    this.chartData = [];
    
    // Sensor data
    this.calibrationOffset = { x: 0, y: 0, z: 0 };
    this.sensorData = [];
    this.accelerationBuffer = [];
    this.velocityBuffer = [];
    this.motionThreshold = 0.5;
    this.noiseThreshold = 2.0;
    this.isMoving = false;
    this.stationaryTime = 0;
    this.lastValidAcceleration = 0;
    
    // GPS
    this.gpsSpeed = 0;
    this.gpsLastUpdate = 0;
    this.gpsAvailable = false;
    this.lastGpsPosition = null;
    this.velocityConfidence = 0;
    
    // Launch detection
    this.launchDetected = false;
    this.launchTime = null;
    this.launchAccelerationBuffer = [];
    
    // Metrics
    this.initMetrics();
    this.initUI();
    this.initSensors();
  }

  initMetrics() {
    this.metricDefinitions = {
      speed: [
        { id: '0-40kph', label: '0-40 km/h', target: null, recent: null, best: null, history: [] },
        { id: '0-60kph', label: '0-60 km/h', target: null, recent: null, best: null, history: [] },
        { id: '0-80kph', label: '0-80 km/h', target: null, recent: null, best: null, history: [] },
        { id: '0-100kph', label: '0-100 km/h', target: null, recent: null, best: null, history: [] },
        { id: '0-120kph', label: '0-120 km/h', target: null, recent: null, best: null, history: [], conditional: true },
        { id: '0-200kph', label: '0-200 km/h', target: null, recent: null, best: null, history: [], conditional: true },
        { id: '0-30mph', label: '0-30 mph', target: null, recent: null, best: null, history: [] },
        { id: '0-60mph', label: '0-60 mph', target: null, recent: null, best: null, history: [] },
        { id: '60-100mph', label: '60-100 mph', target: null, recent: null, best: null, history: [], conditional: true },
        { id: '0-100mph', label: '0-100 mph', target: null, recent: null, best: null, history: [], conditional: true },
        { id: '0-150mph', label: '0-150 mph', target: null, recent: null, best: null, history: [], conditional: true }
      ],
      distance: [
        { id: '1000m', label: '1000m', target: '22.6s', recent: null, best: null, history: [] },
        { id: '1/8mile', label: '1/8 mile', target: '8.7s @ 97.6mph', recent: null, best: null, history: [] },
        { id: '1/4mile', label: '1/4 mile', target: '11.9s @ 116.2mph', recent: null, best: null, history: [] },
        { id: '1mile', label: '1 mile', target: '30.9s @ 161.6mph', recent: null, best: null, history: [], conditional: true }
      ]
    };
    
    // Track achieved speeds during a run
    this.runAchievements = {
      speedTargets: {
        '0-40kph': { achieved: false, fromSpeed: 0 },
        '0-60kph': { achieved: false, fromSpeed: 0 },
        '0-80kph': { achieved: false, fromSpeed: 0 },
        '0-100kph': { achieved: false, fromSpeed: 0 },
        '0-120kph': { achieved: false, fromSpeed: 0 },
        '0-200kph': { achieved: false, fromSpeed: 0 },
        '0-30mph': { achieved: false, fromSpeed: 0 },
        '0-60mph': { achieved: false, fromSpeed: 0 },
        '60-100mph': { achieved: false, fromSpeed: 60 },
        '0-100mph': { achieved: false, fromSpeed: 0 },
        '0-150mph': { achieved: false, fromSpeed: 0 }
      }
    };
    
    this.runDistanceAchievements = {};
    this.loadMetricHistory();
  }

  initUI() {
    // Apply theme
    document.body.className = this.darkMode ? 'dark-mode' : 'light-mode';
    
    // Get elements
    this.elements = {
      speedValue: document.getElementById('speedValue'),
      speedUnit: document.getElementById('speedUnit'),
      speedSign: document.getElementById('speedSign'),
      startBtn: document.getElementById('startBtn'),
      stopBtn: document.getElementById('stopBtn'),
      resetBtn: document.getElementById('resetBtn'),
      chart: document.getElementById('chart'),
      metricsGrid: document.getElementById('metricsGrid'),
      recordingIndicator: document.getElementById('recordingIndicator'),
      settingsButton: document.getElementById('settingsButton'),
      settingsModal: document.getElementById('settingsModal'),
      closeSettings: document.getElementById('closeSettings'),
      darkModeToggle: document.getElementById('darkModeToggle'),
      metricToggle: document.getElementById('metricToggle'),
      calibrationModal: document.getElementById('calibrationModal'),
      calibrationProgress: document.getElementById('calibrationProgress'),
      calibrationText: document.getElementById('calibrationText'),
      historyModal: document.getElementById('historyModal'),
      historyHeader: document.getElementById('historyHeader'),
      historyTableBody: document.getElementById('historyTableBody'),
      closeHistory: document.getElementById('closeHistory'),
      confirmModal: document.getElementById('confirmModal'),
      confirmYes: document.getElementById('confirmYes'),
      confirmNo: document.getElementById('confirmNo')
    };
    
    // Set initial states
    this.elements.darkModeToggle.classList.toggle('active', this.darkMode);
    this.elements.metricToggle.classList.toggle('active', this.isMetric);
    this.elements.speedUnit.textContent = this.isMetric ? 'km/h' : 'mph';
    
    // Event listeners
    this.elements.startBtn.addEventListener('click', () => this.startRun());
    this.elements.stopBtn.addEventListener('click', () => this.stopRun());
    this.elements.resetBtn.addEventListener('click', () => this.showResetConfirmation());
    this.elements.settingsButton.addEventListener('click', () => this.openSettings());
    this.elements.closeSettings.addEventListener('click', () => this.closeSettings());
    this.elements.closeHistory.addEventListener('click', () => this.closeHistoryModal());
    this.elements.confirmYes.addEventListener('click', () => this.confirmReset());
    this.elements.confirmNo.addEventListener('click', () => this.closeConfirmModal());
    
    this.elements.darkModeToggle.addEventListener('click', () => this.toggleDarkMode());
    this.elements.metricToggle.addEventListener('click', () => this.toggleUnits());
    
    // Initialize chart
    this.initChart();
    this.renderMetrics();
  }

  initSensors() {
    // Device Motion
    if (window.DeviceMotionEvent) {
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        // iOS - will request on first run
      } else {
        // Android
        window.addEventListener('devicemotion', (event) => this.handleDeviceMotion(event));
      }
    }
    
    // GPS
    if ('geolocation' in navigator) {
      navigator.geolocation.watchPosition(
        (position) => this.handleGPSUpdate(position),
        (error) => console.warn('GPS error:', error),
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
      );
    }
  }

  async startRun() {
    // Request iOS permissions if needed
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceMotionEvent.requestPermission();
        if (permission !== 'granted') {
          alert('Motion permission required');
          return;
        }
        window.addEventListener('devicemotion', (event) => this.handleDeviceMotion(event));
      } catch (error) {
        alert('Unable to access sensors');
        return;
      }
    }
    
    // Start calibration
    if (!this.isCalibrated) {
      await this.startCalibration();
    }
    
    // Begin run
    this.isRunning = true;
    this.runStartTime = performance.now();
    this.velocity = 0;
    this.distance = 0;
    this.chartData = [];
    this.lastTimestamp = 0;
    this.accelerationBuffer = [];
    this.velocityBuffer = [];
    this.isMoving = false;
    this.launchDetected = false;
    this.launchTime = null;
    this.launchAccelerationBuffer = [];
    
    // Reset achievements
    Object.keys(this.runAchievements.speedTargets).forEach(key => {
      this.runAchievements.speedTargets[key].achieved = false;
    });
    this.runDistanceAchievements = {};
    
    // Update UI
    this.elements.startBtn.classList.add('hidden');
    this.elements.stopBtn.classList.remove('hidden');
    this.elements.recordingIndicator.classList.add('active');
    
    this.updateChart();
  }

  stopRun() {
    this.isRunning = false;
    this.elements.startBtn.classList.remove('hidden');
    this.elements.stopBtn.classList.add('hidden');
    this.elements.recordingIndicator.classList.remove('active');
    
    this.saveRun();
  }

  async startCalibration() {
    this.elements.calibrationModal.classList.add('show');
    this.elements.calibrationText.textContent = 'Keep device still...';
    
    const calibrationData = [];
    const calibrationTime = 3000; // 3 seconds
    const startTime = performance.now();
    
    return new Promise((resolve) => {
      const calibrationInterval = setInterval(() => {
        const elapsed = performance.now() - startTime;
        const progress = (elapsed / calibrationTime) * 100;
        this.elements.calibrationProgress.style.width = `${Math.min(progress, 100)}%`;
        
        if (this.sensorData.length > 0) {
          calibrationData.push({...this.sensorData[this.sensorData.length - 1]});
        }
        
        if (elapsed >= calibrationTime) {
          clearInterval(calibrationInterval);
          this.finishCalibration(calibrationData);
          resolve();
        }
      }, 50);
    });
  }

  finishCalibration(calibrationData) {
    if (calibrationData.length > 10) {
      const xValues = calibrationData.map(d => d.x).sort((a, b) => a - b);
      const yValues = calibrationData.map(d => d.y).sort((a, b) => a - b);
      const zValues = calibrationData.map(d => d.z).sort((a, b) => a - b);
      
      const medianIndex = Math.floor(calibrationData.length / 2);
      this.calibrationOffset = {
        x: xValues[medianIndex],
        y: yValues[medianIndex],
        z: zValues[medianIndex]
      };
      
      this.isCalibrated = true;
    }
    
    this.elements.calibrationModal.classList.remove('show');
    this.elements.calibrationProgress.style.width = '0%';
  }

  handleDeviceMotion(event) {
    if (event.accelerationIncludingGravity) {
      this.processSensorData({
        x: event.accelerationIncludingGravity.x,
        y: event.accelerationIncludingGravity.y,
        z: event.accelerationIncludingGravity.z - 9.81,
        timestamp: performance.now()
      });
    }
  }

  processSensorData(data) {
    // Apply calibration
    const calibratedData = {
      x: data.x - this.calibrationOffset.x,
      y: data.y - this.calibrationOffset.y,
      z: data.z - this.calibrationOffset.z,
      timestamp: data.timestamp
    };
    
    // Apply filtering
    const processedData = this.applyFiltering(calibratedData);
    this.sensorData.push(processedData);
    
    if (this.isRunning) {
      this.updateMetrics(processedData);
    }
    
    // Keep buffer manageable
    if (this.sensorData.length > 1000) {
      this.sensorData.shift();
    }
  }

  applyFiltering(data) {
    const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
    
    this.accelerationBuffer.push({
      magnitude: magnitude,
      timestamp: data.timestamp,
      raw: { x: data.x, y: data.y, z: data.z }
    });
    
    if (this.accelerationBuffer.length > 20) {
      this.accelerationBuffer.shift();
    }
    
    // Noise rejection
    if (magnitude > this.noiseThreshold * 5) {
      return {
        ...data,
        filteredMagnitude: this.lastValidAcceleration
      };
    }
    
    // Moving average filter
    let filteredMagnitude = magnitude;
    if (this.accelerationBuffer.length >= 5) {
      const recentMagnitudes = this.accelerationBuffer
        .slice(-10)
        .map(d => d.magnitude)
        .sort((a, b) => a - b);
      
      const trimCount = Math.floor(recentMagnitudes.length * 0.05);
      const trimmedData = recentMagnitudes.slice(trimCount, -trimCount || undefined);
      filteredMagnitude = trimmedData.reduce((sum, val) => sum + val, 0) / trimmedData.length;
    }
    
    // Motion detection
    if (!this.isMoving && filteredMagnitude > this.motionThreshold) {
      this.isMoving = true;
      this.stationaryTime = 0;
    } else if (this.isMoving && filteredMagnitude < this.motionThreshold * 0.5) {
      this.stationaryTime += 1;
      if (this.stationaryTime > 100) {
        this.isMoving = false;
        if (this.isRunning) {
          this.velocity *= 0.95;
        }
      }
    }
    
    this.lastValidAcceleration = filteredMagnitude;
    
    return {
      ...data,
      filteredMagnitude: filteredMagnitude,
      isMoving: this.isMoving
    };
  }

  handleGPSUpdate(position) {
    const now = performance.now();
    this.gpsLastUpdate = now;
    
    if (position.coords.speed !== null && position.coords.speed >= 0) {
      this.gpsSpeed = position.coords.speed; // m/s
      this.gpsAvailable = true;
    }
    
    if (this.lastGpsPosition && this.isRunning) {
      const distance = this.calculateDistance(
        this.lastGpsPosition.coords.latitude,
        this.lastGpsPosition.coords.longitude,
        position.coords.latitude,
        position.coords.longitude
      );
      
      const timeDiff = (now - this.lastGpsPosition.timestamp) / 1000;
      if (timeDiff > 0 && distance > 0) {
        const gpsCalculatedSpeed = distance / timeDiff;
        this.validateAccelerometerSpeed(gpsCalculatedSpeed);
      }
    }
    
    this.lastGpsPosition = {
      coords: position.coords,
      timestamp: now
    };
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
             Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
             Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  validateAccelerometerSpeed(gpsSpeed) {
    const accelerometerSpeed = Math.abs(this.velocity);
    const speedDifference = Math.abs(accelerometerSpeed - gpsSpeed);
    const tolerance = Math.max(gpsSpeed * 0.3, 2.0);
    
    if (speedDifference > tolerance) {
      const correctionFactor = gpsSpeed / Math.max(accelerometerSpeed, 0.1);
      this.velocity *= Math.min(Math.max(correctionFactor, 0.5), 2.0);
      this.velocityConfidence = Math.max(0, this.velocityConfidence - 0.2);
    } else {
      this.velocityConfidence = Math.min(1.0, this.velocityConfidence + 0.1);
    }
  }

  updateMetrics(sensorData) {
    if (!this.runStartTime) return;
    
    const timeElapsed = (sensorData.timestamp - this.runStartTime) / 1000;
    const dt = timeElapsed - this.lastTimestamp;
    
    if (dt <= 0) return;
    
    const acceleration = sensorData.filteredMagnitude || 0;
    
    // GPS fusion
    const gpsAge = (sensorData.timestamp - this.gpsLastUpdate) / 1000;
    const gpsReliable = this.gpsAvailable && gpsAge < 2.0;
    
    // Update velocity
    if (sensorData.isMoving && acceleration > this.motionThreshold) {
      const velocityChange = acceleration * dt;
      this.velocity += velocityChange;
      
      if (gpsReliable && this.gpsSpeed >= 0) {
        const gpsWeight = Math.min(0.3, this.velocityConfidence * 0.5);
        this.velocity = (1 - gpsWeight) * this.velocity + gpsWeight * this.gpsSpeed;
      }
      
      this.velocityBuffer.push(this.velocity);
      if (this.velocityBuffer.length > 10) {
        this.velocityBuffer.shift();
      }
      
      if (this.velocityBuffer.length >= 3) {
        const sortedVelocities = [...this.velocityBuffer].sort((a, b) => a - b);
        const medianIndex = Math.floor(sortedVelocities.length / 2);
        this.velocity = sortedVelocities[medianIndex];
      }
    } else if (!sensorData.isMoving) {
      if (gpsReliable && this.gpsSpeed < 1.0) {
        this.velocity *= 0.5;
      } else {
        this.velocity *= 0.85;
      }
      
      if (Math.abs(this.velocity) < 0.2) {
        this.velocity = 0;
      }
    }
    
    // Drift correction
    if (gpsReliable && this.gpsSpeed < 0.5 && Math.abs(this.velocity) > 2.0) {
      this.velocity *= 0.3;
    }
    
    this.velocity = Math.max(0, this.velocity);
    
    // Launch detection
    if (!this.launchDetected) {
      this.detectLaunch(acceleration, sensorData.isMoving, timeElapsed);
    }
    
    // Update distance
    if (this.velocity > 0) {
      this.distance += this.velocity * dt;
    }
    
    // Convert to display units
    const speedKph = this.velocity * 3.6;
    const speedMph = speedKph * 0.621371;
    const distanceM = this.distance;
    
    // Add to chart
    const currentSpeed = this.isMetric ? speedKph : speedMph;
    this.chartData.push({ 
      time: timeElapsed, 
      speed: currentSpeed
    });
    
    // Keep last 30 seconds
    this.chartData = this.chartData.filter(d => d.time > timeElapsed - 30);
    
    this.updateChart();
    
    // Update speed display
    const speedValue = Math.round(currentSpeed);
    this.elements.speedValue.textContent = speedValue;
    
    if (sensorData.isMoving && speedValue > 5) {
      this.elements.speedSign.classList.add('moving');
    } else {
      this.elements.speedSign.classList.remove('moving');
    }
    
    // Check metrics
    this.checkSpeedMetric('0-40kph', speedKph, 40);
    this.checkSpeedMetric('0-60kph', speedKph, 60);
    this.checkSpeedMetric('0-80kph', speedKph, 80);
    this.checkSpeedMetric('0-100kph', speedKph, 100);
    this.checkSpeedMetric('0-120kph', speedKph, 120);
    this.checkSpeedMetric('0-200kph', speedKph, 200);
    this.checkSpeedMetric('0-30mph', speedMph, 30);
    this.checkSpeedMetric('0-60mph', speedMph, 60);
    this.checkSpeedMetric('60-100mph', speedMph, 100, 60);
    this.checkSpeedMetric('0-100mph', speedMph, 100);
    this.checkSpeedMetric('0-150mph', speedMph, 150);
    
    this.checkDistanceMetric('1000m', distanceM, 1000, timeElapsed);
    this.checkDistanceMetric('1/8mile', distanceM, 201.168, timeElapsed);
    this.checkDistanceMetric('1/4mile', distanceM, 402.336, timeElapsed);
    this.checkDistanceMetric('1mile', distanceM, 1609.344, timeElapsed);
    
    this.lastTimestamp = timeElapsed;
    this.renderMetrics();
  }

  detectLaunch(acceleration, isMoving, timeElapsed) {
    this.launchAccelerationBuffer.push({
      acceleration: acceleration,
      isMoving: isMoving,
      timestamp: timeElapsed
    });
    
    this.launchAccelerationBuffer = this.launchAccelerationBuffer.filter(
      data => data.timestamp > timeElapsed - 2.0
    );
    
    if (this.launchAccelerationBuffer.length >= 10) {
      const recentData = this.launchAccelerationBuffer.slice(-10);
      const sustainedAcceleration = recentData.every(d => d.acceleration > 1.5 && d.isMoving);
      const isAccelerating = this.velocity > 2.0;
      
      const longerBuffer = this.launchAccelerationBuffer.filter(
        data => data.timestamp > timeElapsed - 0.5
      );
      const sustainedLaunch = longerBuffer.length >= 25 &&
        longerBuffer.filter(d => d.acceleration > 1.0 && d.isMoving).length >= longerBuffer.length * 0.8;
      
      if (sustainedAcceleration && isAccelerating && sustainedLaunch) {
        this.launchDetected = true;
        this.launchTime = performance.now();
      }
    }
  }

  checkSpeedMetric(id, currentSpeed, targetSpeed, fromSpeed = 0) {
    const metric = this.metricDefinitions.speed.find(m => m.id === id);
    const achievement = this.runAchievements.speedTargets[id];
    
    if (metric && achievement && !achievement.achieved && currentSpeed >= targetSpeed) {
      let timeElapsed;
      if (this.launchDetected && this.launchTime) {
        timeElapsed = (performance.now() - this.launchTime) / 1000;
      } else {
        timeElapsed = (performance.now() - this.runStartTime) / 1000;
      }
      const timeValue = timeElapsed.toFixed(2);
      
      achievement.achieved = true;
      
      const historyEntry = {
        time: parseFloat(timeValue),
        timeString: `${timeValue}s`,
        timestamp: new Date().toISOString(),
        dateString: new Date().toLocaleString()
      };
      
      metric.history.push(historyEntry);
      metric.recent = historyEntry.timeString;
      
      const sortedHistory = [...metric.history].sort((a, b) => a.time - b.time);
      metric.best = sortedHistory[0].timeString;
      
      this.saveMetricHistory();
      this.playTone(800, 200);
    }
  }

  checkDistanceMetric(id, currentDistance, targetDistance, timeElapsedFromRunStart) {
    const metric = this.metricDefinitions.distance.find(m => m.id === id);
    
    if (!this.runDistanceAchievements) {
      this.runDistanceAchievements = {};
    }
    
    if (metric && currentDistance >= targetDistance && !this.runDistanceAchievements[id]) {
      const speed = this.isMetric ? this.velocity * 3.6 : this.velocity * 2.237;
      const unit = this.isMetric ? 'km/h' : 'mph';
      
      let timeElapsed;
      if (this.launchDetected && this.launchTime) {
        timeElapsed = (performance.now() - this.launchTime) / 1000;
      } else {
        timeElapsed = timeElapsedFromRunStart;
      }
      const timeValue = timeElapsed.toFixed(2);
      
      const historyEntry = {
        time: parseFloat(timeValue),
        timeString: `${timeValue}s @ ${speed.toFixed(1)}${unit}`,
        timestamp: new Date().toISOString(),
        dateString: new Date().toLocaleString()
      };
      
      metric.history.push(historyEntry);
      metric.recent = historyEntry.timeString;
      
      const sortedHistory = [...metric.history].sort((a, b) => a.time - b.time);
      metric.best = sortedHistory[0].timeString;
      
      this.saveMetricHistory();
      this.playTone(1000, 300);
      
      this.runDistanceAchievements[id] = true;
    }
  }

  playTone(frequency, duration) {
    if ('AudioContext' in window || 'webkitAudioContext' in window) {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration / 1000);
    }
  }

  loadMetricHistory() {
    try {
      const saved = localStorage.getItem('dragRacingMetricHistory');
      if (saved) {
        const data = JSON.parse(saved);
        
        data.speed?.forEach(savedMetric => {
          const metric = this.metricDefinitions.speed.find(m => m.id === savedMetric.id);
          if (metric) {
            metric.history = savedMetric.history || [];
            metric.recent = savedMetric.recent;
            metric.best = savedMetric.best;
          }
        });
        
        data.distance?.forEach(savedMetric => {
          const metric = this.metricDefinitions.distance.find(m => m.id === savedMetric.id);
          if (metric) {
            metric.history = savedMetric.history || [];
            metric.recent = savedMetric.recent;
            metric.best = savedMetric.best;
          }
        });
      }
    } catch (error) {
      console.warn('Error loading metric history:', error);
    }
  }

  saveMetricHistory() {
    try {
      const data = {
        speed: this.metricDefinitions.speed.map(m => ({
          id: m.id,
          history: m.history,
          recent: m.recent,
          best: m.best
        })),
        distance: this.metricDefinitions.distance.map(m => ({
          id: m.id,
          history: m.history,
          recent: m.recent,
          best: m.best
        }))
      };
      
      localStorage.setItem('dragRacingMetricHistory', JSON.stringify(data));
    } catch (error) {
      console.warn('Error saving metric history:', error);
    }
  }

  saveRun() {
    // Save current run data
    const runs = JSON.parse(localStorage.getItem('dragRacingRuns') || '[]');
    const runData = {
      timestamp: new Date().toISOString(),
      metrics: JSON.parse(JSON.stringify(this.metricDefinitions)),
      chartData: [...this.chartData]
    };
    
    runs.unshift(runData);
    if (runs.length > 10) runs.pop();
    
    localStorage.setItem('dragRacingRuns', JSON.stringify(runs));
  }

  renderMetrics() {
    const visibleMetrics = [...this.metricDefinitions.speed, ...this.metricDefinitions.distance]
      .filter(metric => {
        if (metric.conditional && !metric.recent) {
          return false;
        }
        
        if (this.isMetric) {
          return !metric.label.includes('mph') && !metric.label.includes('mile');
        } else {
          return !metric.label.includes('km/h') && !metric.label.includes('1000m');
        }
      });
    
    this.elements.metricsGrid.innerHTML = visibleMetrics.map(metric => {
      const hasHistory = metric.history && metric.history.length > 0;
      const clickHandler = hasHistory ? `onclick="tracker.showHistoryModal('${metric.id}')"` : '';
      const clickableClass = hasHistory ? 'clickable' : '';
      
      return `
        <div class="metric-card ${metric.recent ? 'achieved' : ''} ${clickableClass}" ${clickHandler}>
          <div class="metric-label">${metric.label}</div>
          <div class="metric-recent">${metric.recent || '---'}</div>
          ${metric.best ? `<div class="metric-best">Best: ${metric.best}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  initChart() {
    this.ctx = this.elements.chart.getContext('2d');
    setTimeout(() => {
      this.resizeChart();
    }, 100);
    window.addEventListener('resize', () => this.resizeChart());
  }

  resizeChart() {
    const rect = this.elements.chart.parentElement.getBoundingClientRect();
    this.elements.chart.width = rect.width - 4;
    this.elements.chart.height = rect.height - 4;
    this.updateChart();
  }

  updateChart() {
    if (!this.ctx) return;
    
    const canvas = this.elements.chart;
    const ctx = this.ctx;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const chartArea = {
      left: 10,
      right: canvas.width - 40,
      top: 30,
      bottom: canvas.height - 40
    };
    const chartWidth = chartArea.right - chartArea.left;
    const chartHeight = chartArea.bottom - chartArea.top;
    
    // Find max speed
    let maxSpeed = 50;
    let minTime = 0;
    let maxTime = 1;
    let timeRange = 1;
    
    if (this.chartData.length > 0) {
      maxSpeed = Math.max(...this.chartData.map(d => d.speed), 50);
      minTime = Math.min(...this.chartData.map(d => d.time));
      maxTime = Math.max(...this.chartData.map(d => d.time));
      timeRange = Math.max(maxTime - minTime, 1);
    }
    
    // Grid
    const isDark = document.body.classList.contains('dark-mode');
    ctx.strokeStyle = isDark ? '#333' : '#E0E0E0';
    ctx.lineWidth = 0.5;
    
    for (let i = 1; i < 6; i++) {
      const x = chartArea.left + (chartWidth / 6) * i;
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();
    }
    
    for (let i = 1; i < 5; i++) {
      const y = chartArea.top + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.stroke();
    }
    
    // Labels
    ctx.fillStyle = isDark ? '#ccc' : '#666';
    ctx.font = '11px Inter';
    
    // Y-axis
    for (let i = 0; i <= 5; i++) {
      const speedValue = (maxSpeed / 5) * i;
      const y = chartArea.bottom - (i / 5) * chartHeight;
      ctx.textAlign = 'left';
      ctx.fillText(`${speedValue.toFixed(0)}`, chartArea.right + 5, y + 4);
    }
    
    // Y-axis label
    ctx.fillStyle = isDark ? '#fff' : '#1A1A1A';
    ctx.font = '12px Inter';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(canvas.width - 10, chartArea.top + chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`Speed (${this.isMetric ? 'km/h' : 'mph'})`, 0, 0);
    ctx.restore();
    
    // X-axis
    ctx.fillStyle = isDark ? '#ccc' : '#666';
    ctx.font = '11px Inter';
    ctx.textAlign = 'center';
    
    for (let i = 0; i <= 6; i++) {
      const timeValue = (timeRange / 6) * i;
      const secondsAgo = timeRange - timeValue;
      const x = chartArea.left + (i / 6) * chartWidth;
      ctx.fillText(`${secondsAgo.toFixed(0)}s`, x, chartArea.bottom + 15);
    }
    
    ctx.fillStyle = isDark ? '#fff' : '#1A1A1A';
    ctx.font = '12px Inter';
    ctx.fillText('Seconds Ago', chartArea.left + chartWidth / 2, canvas.height - 8);
    
    // Draw speed line
    if (this.chartData.length >= 1) {
      ctx.strokeStyle = '#6C8EAD';
      ctx.lineWidth = 3;
      ctx.beginPath();
      
      this.chartData.forEach((point, index) => {
        const x = chartArea.left + ((point.time - minTime) / timeRange) * chartWidth;
        const y = chartArea.bottom - (point.speed / maxSpeed) * chartHeight;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
    }
  }

  toggleDarkMode() {
    this.darkMode = !this.darkMode;
    localStorage.setItem('darkMode', this.darkMode);
    document.body.className = this.darkMode ? 'dark-mode' : 'light-mode';
    this.elements.darkModeToggle.classList.toggle('active', this.darkMode);
    this.updateChart();
  }

  toggleUnits() {
    this.isMetric = !this.isMetric;
    localStorage.setItem('isMetric', this.isMetric);
    this.elements.metricToggle.classList.toggle('active', this.isMetric);
    this.elements.speedUnit.textContent = this.isMetric ? 'km/h' : 'mph';
    this.renderMetrics();
    this.updateChart();
  }

  openSettings() {
    this.elements.settingsModal.classList.add('show');
  }

  closeSettings() {
    this.elements.settingsModal.classList.remove('show');
  }

  showHistoryModal(metricId) {
    const allMetrics = [...this.metricDefinitions.speed, ...this.metricDefinitions.distance];
    const metric = allMetrics.find(m => m.id === metricId);
    
    if (!metric || !metric.history.length) return;
    
    const sortedHistory = [...metric.history].sort((a, b) => a.time - b.time);
    
    this.elements.historyHeader.textContent = `${metric.label} History`;
    this.elements.historyTableBody.innerHTML = sortedHistory.map((entry, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${entry.timeString}</td>
        <td>${entry.dateString}</td>
      </tr>
    `).join('');
    
    this.elements.historyModal.classList.add('show');
  }

  closeHistoryModal() {
    this.elements.historyModal.classList.remove('show');
  }

  showResetConfirmation() {
    this.closeSettings();
    this.elements.confirmModal.classList.add('show');
  }

  closeConfirmModal() {
    this.elements.confirmModal.classList.remove('show');
  }

  confirmReset() {
    // Clear all data
    this.metricDefinitions.speed.forEach(metric => {
      metric.recent = null;
      metric.best = null;
      metric.history = [];
    });
    this.metricDefinitions.distance.forEach(metric => {
      metric.recent = null;
      metric.best = null;
      metric.history = [];
    });
    
    localStorage.removeItem('dragRacingMetricHistory');
    localStorage.removeItem('dragRacingRuns');
    
    if (this.isRunning) {
      this.stopRun();
    }
    
    this.velocity = 0;
    this.distance = 0;
    this.chartData = [];
    this.elements.speedValue.textContent = '0';
    
    this.updateChart();
    this.renderMetrics();
    this.closeConfirmModal();
  }
}

// Initialize tracker when page loads
let tracker;
document.addEventListener('DOMContentLoaded', () => {
  tracker = new SpeedTracker();
  window.tracker = tracker;
});

