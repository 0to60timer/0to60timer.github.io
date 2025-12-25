// Tracker App - Optimized for mobile racing
// Enhanced sensor fusion for accurate speed tracking
class SpeedTracker {
  constructor() {
    // Settings
    this.darkMode = localStorage.getItem('darkMode') !== 'false'; // default true
    this.isMetric = localStorage.getItem('isMetric') === 'true'; // default false (mph)
    
    // Load visible metrics settings (separate for mph and km/h)
    this.visibleMetrics = {
      mph: JSON.parse(localStorage.getItem('visibleMetrics_mph') || 'null'),
      kmh: JSON.parse(localStorage.getItem('visibleMetrics_kmh') || 'null')
    };
    
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
    this.stationaryDuration = 0; // Track stationary time in seconds
    this.lastValidAcceleration = 0;
    this.deviceMotionActive = false; // Track if device motion listener is active
    
    // GPS - Enhanced for sensor fusion
    this.gpsSpeed = 0;
    this.gpsLastUpdate = 0;
    this.gpsAvailable = false;
    this.gpsWatchId = null;
    this.lastGpsPosition = null;
    this.velocityConfidence = 0;
    this.gpsDistance = 0; // Track GPS-measured distance
    this.lastDriftCheckTime = 0; // For periodic drift correction
    this.consecutiveZeroGPS = 0; // Count how many times GPS shows zero speed
    
    // === ENHANCED SENSOR FUSION ===
    // Kalman-like filter state
    this.fusedSpeed = 0; // The final fused speed (m/s)
    this.speedEstimateUncertainty = 10; // Uncertainty of our speed estimate
    this.gpsAccuracy = 0; // GPS accuracy from coords.accuracy
    this.lastFusionTime = 0;
    
    // GPS history for smoothing and reliability detection
    this.gpsSpeedHistory = []; // Last N GPS readings
    this.gpsSpeedHistoryMaxSize = 10;
    this.gpsReliabilityScore = 0; // 0-1, how reliable is GPS right now
    
    // Accelerometer integration state
    this.accelIntegratedSpeed = 0; // Speed from accelerometer integration
    this.accelSpeedUncertainty = 0; // Grows with integration time
    this.lastAccelTimestamp = 0;
    this.accelDriftRate = 0.5; // m/s per second of drift uncertainty
    
    // Moving start detection
    this.initialGpsReceived = false;
    this.wasMovingAtStart = false;
    this.startupGpsReadings = [];
    this.startupComplete = false;
    
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
      startBtn: document.getElementById('startBtn'), // Legacy (hidden)
      headerStartBtn: document.getElementById('headerStartBtn'),
      headerStopBtn: document.getElementById('headerStopBtn'),
      resetBtn: document.getElementById('resetBtn'),
      chart: document.getElementById('chart'),
      metricsGrid: document.getElementById('metricsGrid'),
      recordingIndicator: document.getElementById('recordingIndicator'),
      settingsButton: document.getElementById('settingsButton'),
      settingsModal: document.getElementById('settingsModal'),
      closeSettings: document.getElementById('closeSettings'),
      darkModeToggle: document.getElementById('darkModeToggle'),
      metricToggle: document.getElementById('metricToggle'),
      metricSelection: document.getElementById('metricSelection'),
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
    this.elements.startBtn.addEventListener('click', () => this.startRun()); // Legacy
    this.elements.headerStartBtn.addEventListener('click', () => this.startRun());
    this.elements.headerStopBtn.addEventListener('click', () => this.stopRun());
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
    this.renderMetricSelection();
    this.renderMetrics();
    
    // Auto-start run on page load
    setTimeout(() => {
      this.autoStartRun();
    }, 500); // Small delay to ensure everything is initialized
  }

  async autoStartRun() {
    // Auto-start tracking on page load
    try {
      // For iOS, we need user interaction to request device motion permission
      // But GPS can start automatically if permission was already granted
      if ('DeviceMotionEvent' in window && typeof DeviceMotionEvent.requestPermission === 'function') {
        console.log('iOS device detected - GPS will start, motion requires button click');
        // Start the run - GPS will begin, device motion will be requested on first user interaction
        this.startRun();
        return;
      }
      
      // For Android, start the run immediately
      console.log('Auto-starting run');
      this.startRun();
    } catch (error) {
      console.log('Auto-start failed:', error);
    }
  }

  async initSensors() {
    // Device Motion
    if (window.DeviceMotionEvent) {
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        // iOS - will request on first run
      } else {
        // Android - set up passive listener
        window.addEventListener('devicemotion', (event) => this.handleDeviceMotion(event));
        this.deviceMotionActive = true;
      }
    }
    
    // GPS - Check if available
    if ('geolocation' in navigator) {
      this.gpsAvailable = true;
      
      // Try to check permission status without prompting (Permissions API)
      if ('permissions' in navigator) {
        try {
          const result = await navigator.permissions.query({ name: 'geolocation' });
          console.log('Geolocation permission status:', result.state);
          
          if (result.state === 'granted') {
            // Permission already granted, we can start watching immediately when run starts
            console.log('GPS permission already granted, ready to track');
          } else if (result.state === 'denied') {
            console.warn('GPS permission denied, will redirect to access page if needed');
          }
          // 'prompt' state means we'll need to request on first use
        } catch (error) {
          // Permissions API not fully supported, will handle on first use
          console.log('Permissions API not available, will check on first GPS use');
        }
      }
    }
  }

  async startRun() {
    // Don't start again if already running
    if (this.isRunning) {
      return;
    }
    
    // Start GPS watching FIRST (before any async operations)
    // This ensures it's called synchronously with the user gesture
    if (this.gpsAvailable && !this.gpsWatchId) {
      try {
        // CRITICAL: Call this before any await to maintain user gesture context
        this.gpsWatchId = navigator.geolocation.watchPosition(
          (position) => this.handleGPSUpdate(position),
          (error) => {
            console.warn('GPS error:', error);
            // If permission denied, redirect to access page
            if (error.code === error.PERMISSION_DENIED) {
              console.error('GPS permission denied, redirecting to access page');
              window.location.href = 'access.html?redirect=tracker';
            }
          },
          { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
        );
        console.log('GPS watching started');
      } catch (error) {
        console.error('Failed to start GPS watching:', error);
      }
    }
    
    // Request iOS permissions if needed and not already done
    if (typeof DeviceMotionEvent.requestPermission === 'function' && !this.deviceMotionActive) {
      try {
        const permission = await DeviceMotionEvent.requestPermission();
        if (permission !== 'granted') {
          console.log('Motion permission not granted - GPS tracking will continue');
          // Don't stop GPS, just continue with GPS-only tracking
          // User can click "Start Run" button to grant motion permission
        } else {
          window.addEventListener('devicemotion', (event) => this.handleDeviceMotion(event));
          this.deviceMotionActive = true;
          console.log('Device motion permission granted');
        }
      } catch (error) {
        // This will happen on auto-start since there's no user gesture
        // Just continue with GPS tracking
        console.log('Device motion permission requires user interaction - GPS tracking active');
      }
    }
    
    // Start calibration - skip if user was moving at start
    if (!this.isCalibrated && !this.wasMovingAtStart) {
      await this.startCalibration();
    } else if (this.wasMovingAtStart) {
      console.log('Skipping calibration - moving start detected, using GPS for initial state');
    }
    
    // Begin run
    this.isRunning = true;
    this.runStartTime = performance.now();
    
    // === SENSOR FUSION STATE RESET ===
    // Don't reset velocity to 0 if we detected moving start
    if (!this.wasMovingAtStart) {
    this.velocity = 0;
      this.fusedSpeed = 0;
      this.accelIntegratedSpeed = 0;
    }
    // If wasMovingAtStart is true, velocity was already set from GPS in detectMovingStart()
    
    this.distance = 0;
    this.gpsDistance = 0; // Reset GPS distance tracking
    this.lastDriftCheckTime = 0; // Reset drift check timer
    this.consecutiveZeroGPS = 0; // Reset zero GPS counter
    this.speedEstimateUncertainty = this.wasMovingAtStart ? 2 : 10;
    this.accelSpeedUncertainty = 0;
    this.lastFusionTime = 0;
    this.lastAccelTimestamp = 0;
    
    this.chartData = [];
    this.lastTimestamp = 0;
    this.accelerationBuffer = [];
    this.velocityBuffer = [];
    this.isMoving = this.wasMovingAtStart; // Keep moving state if already moving
    this.launchDetected = false;
    this.launchTime = null;
    this.launchAccelerationBuffer = [];
    
    // Reset achievements
    Object.keys(this.runAchievements.speedTargets).forEach(key => {
      this.runAchievements.speedTargets[key].achieved = false;
    });
    this.runDistanceAchievements = {};
    
    // Update UI
    this.elements.startBtn.classList.add('hidden'); // Legacy
    this.elements.headerStartBtn.classList.add('hidden');
    this.elements.headerStopBtn.classList.add('active');
    this.elements.recordingIndicator.classList.add('active');
    
    this.updateChart();
  }

  stopRun() {
    this.isRunning = false;
    this.elements.startBtn.classList.remove('hidden'); // Legacy
    this.elements.headerStartBtn.classList.remove('hidden');
    this.elements.headerStopBtn.classList.remove('active');
    this.elements.recordingIndicator.classList.remove('active');
    
    // Stop GPS watching to save battery
    if (this.gpsWatchId) {
      navigator.geolocation.clearWatch(this.gpsWatchId);
      this.gpsWatchId = null;
    }
    
    // Reset sensor fusion state for next run
    this.startupComplete = false;
    this.wasMovingAtStart = false;
    this.startupGpsReadings = [];
    this.gpsSpeedHistory = [];
    this.initialGpsReceived = false;
    
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
    // PREFER Linear Acceleration (hardware gravity removal) if available
    // This is much better at ignoring tilt than manual gravity subtraction
    if (event.acceleration && event.acceleration.x !== null) {
      this.processSensorData({
        x: event.acceleration.x,
        y: event.acceleration.y,
        z: event.acceleration.z,
        timestamp: performance.now(),
        isLinear: true // Flag to skip manual gravity subtraction
      });
    } else if (event.accelerationIncludingGravity) {
      // Fallback for devices without hardware linear acceleration
      this.processSensorData({
        x: event.accelerationIncludingGravity.x,
        y: event.accelerationIncludingGravity.y,
        z: event.accelerationIncludingGravity.z, // passed raw, subtraction happens in process
        timestamp: performance.now(),
        isLinear: false
      });
    }
  }

  processSensorData(data) {
    let calibratedData;
    
    // Track time since last accelerometer reading for fusion
    const timeSinceLastAccel = this.lastAccelTimestamp > 0 ? 
      (data.timestamp - this.lastAccelTimestamp) / 1000 : 0;
    this.lastAccelTimestamp = data.timestamp;
    
    // If too much time passed (screen lock/background), increase uncertainty
    if (timeSinceLastAccel > 0.5) {
      this.accelSpeedUncertainty += timeSinceLastAccel * this.accelDriftRate * 2;
    }
    
    if (data.isLinear) {
      // Linear acceleration: just apply calibration offset (for sensor bias)
      // No need to subtract 9.81
      calibratedData = {
        x: data.x - this.calibrationOffset.x,
        y: data.y - this.calibrationOffset.y,
        z: data.z - this.calibrationOffset.z,
        timestamp: data.timestamp
      };
    } else {
      // Gravity included: subtract calibrated gravity
      // Note: this is prone to tilt errors, but best we can do without linear accel
      calibratedData = {
        x: data.x - this.calibrationOffset.x,
        y: data.y - this.calibrationOffset.y,
        z: (data.z - 9.81) - this.calibrationOffset.z,
        timestamp: data.timestamp
      };
    }
    
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
    
    // Enhanced motion detection with stricter threshold
    if (!this.isMoving && filteredMagnitude > this.motionThreshold * 2) {
      // Require stronger acceleration to consider moving
      this.isMoving = true;
      this.stationaryTime = 0;
    } else if (this.isMoving && filteredMagnitude < this.motionThreshold * 0.3) {
      // Lower threshold for stopping
      this.stationaryTime += 1;
      if (this.stationaryTime > 50) { // Faster stop detection (0.5s at 100Hz)
        this.isMoving = false;
        if (this.isRunning) {
          this.velocity = 0; // Hard stop instead of decay
        }
      }
    } else if (filteredMagnitude < this.motionThreshold * 0.5) {
      // Even if "moving", very low acceleration should increase stationary count
      this.stationaryTime += 1;
    } else {
      this.stationaryTime = 0; // Reset if we see real acceleration
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
    
    // Store GPS accuracy for fusion weighting
    this.gpsAccuracy = position.coords.accuracy || 20; // meters, default 20 if unavailable
    
    if (position.coords.speed !== null && position.coords.speed >= 0) {
      this.gpsSpeed = position.coords.speed; // m/s
      this.gpsAvailable = true;
      
      // === MOVING START DETECTION ===
      // Collect GPS readings during startup to detect if user opened app while moving
      if (!this.startupComplete) {
        this.startupGpsReadings.push({
          speed: this.gpsSpeed,
          accuracy: this.gpsAccuracy,
          timestamp: now
        });
        
        // After 3 GPS readings or 2 seconds, determine if we're moving at start
        if (this.startupGpsReadings.length >= 3 || 
            (this.startupGpsReadings.length > 0 && 
             now - this.startupGpsReadings[0].timestamp > 2000)) {
          this.detectMovingStart();
        }
      }
      
      // === GPS RELIABILITY TRACKING ===
      this.gpsSpeedHistory.push({
        speed: this.gpsSpeed,
        accuracy: this.gpsAccuracy,
        timestamp: now
      });
      if (this.gpsSpeedHistory.length > this.gpsSpeedHistoryMaxSize) {
        this.gpsSpeedHistory.shift();
      }
      this.updateGpsReliability();
      
      // Track consecutive zero speed readings
      if (this.gpsSpeed < 0.3) {
        this.consecutiveZeroGPS++;
      } else {
        this.consecutiveZeroGPS = 0;
      }
      
      // === SENSOR FUSION UPDATE ===
      // When we get a GPS update, fuse it with accelerometer data
      this.performSensorFusion(now);
    }
    
    if (this.lastGpsPosition && this.isRunning) {
      const distance = this.calculateDistance(
        this.lastGpsPosition.coords.latitude,
        this.lastGpsPosition.coords.longitude,
        position.coords.latitude,
        position.coords.longitude
      );
      
      // Accumulate GPS distance
      if (distance > 0 && distance < 100) { // Sanity check: ignore jumps > 100m
        this.gpsDistance += distance;
      }
    }
    
    this.lastGpsPosition = {
      coords: position.coords,
      timestamp: now
    };
  }
  
  // Detect if user opened app while already moving
  detectMovingStart() {
    if (this.startupComplete) return;
    this.startupComplete = true;
    
    // Filter for readings with reasonable accuracy
    const reliableReadings = this.startupGpsReadings.filter(r => r.accuracy < 30);
    
    if (reliableReadings.length === 0) {
      console.log('No reliable GPS readings during startup - assuming stationary');
      this.wasMovingAtStart = false;
      return;
    }
    
    // Calculate average speed from startup readings
    const avgSpeed = reliableReadings.reduce((sum, r) => sum + r.speed, 0) / reliableReadings.length;
    
    // If average speed > 2 m/s (~4.5 mph), user was moving at start
    if (avgSpeed > 2.0) {
      this.wasMovingAtStart = true;
      console.log(`Moving start detected! Avg GPS speed: ${(avgSpeed * 2.237).toFixed(1)} mph`);
      
      // Initialize fused speed from GPS instead of 0
      this.fusedSpeed = avgSpeed;
      this.velocity = avgSpeed;
      this.accelIntegratedSpeed = avgSpeed;
      
      // Skip accelerometer calibration - it would be wrong while moving
      // Trust GPS entirely for initial state
      this.isCalibrated = true;
      this.speedEstimateUncertainty = this.gpsAccuracy * 0.1; // Lower uncertainty since GPS is reliable
    } else {
      this.wasMovingAtStart = false;
      console.log('Stationary start detected - normal calibration applies');
    }
  }
  
  // Calculate GPS reliability based on recent readings
  updateGpsReliability() {
    if (this.gpsSpeedHistory.length < 2) {
      this.gpsReliabilityScore = 0.3; // Low confidence with minimal data
      return;
    }
    
    let reliability = 1.0;
    
    // Factor 1: Accuracy (better accuracy = higher reliability)
    const avgAccuracy = this.gpsSpeedHistory.reduce((sum, r) => sum + r.accuracy, 0) / 
                        this.gpsSpeedHistory.length;
    if (avgAccuracy > 50) reliability *= 0.3;
    else if (avgAccuracy > 20) reliability *= 0.7;
    else if (avgAccuracy > 10) reliability *= 0.9;
    
    // Factor 2: Speed consistency (sudden jumps reduce reliability)
    if (this.gpsSpeedHistory.length >= 3) {
      const speeds = this.gpsSpeedHistory.map(r => r.speed);
      const maxJump = Math.max(...speeds.slice(1).map((s, i) => Math.abs(s - speeds[i])));
      // If speed jumped by more than 5 m/s (~11 mph) between readings, reduce reliability
      if (maxJump > 5) reliability *= 0.5;
      else if (maxJump > 3) reliability *= 0.7;
    }
    
    // Factor 3: Time since last reading (older = less reliable)
    const timeSinceLast = (performance.now() - this.gpsLastUpdate) / 1000;
    if (timeSinceLast > 3) reliability *= 0.5;
    else if (timeSinceLast > 2) reliability *= 0.7;
    
    this.gpsReliabilityScore = Math.max(0.1, Math.min(1.0, reliability));
  }
  
  // Core sensor fusion algorithm
  performSensorFusion(now) {
    const dt = (now - this.lastFusionTime) / 1000;
    if (this.lastFusionTime === 0 || dt <= 0) {
      this.lastFusionTime = now;
      return;
    }
    
    // === KALMAN-LIKE FUSION ===
    // We have two estimates:
    // 1. GPS speed (direct measurement, periodic)
    // 2. Accelerometer-integrated speed (continuous but drifts)
    
    // GPS measurement uncertainty based on accuracy and reliability
    const gpsSpeedUncertainty = Math.max(0.5, this.gpsAccuracy * 0.05) / this.gpsReliabilityScore;
    
    // Accelerometer uncertainty grows with time since last GPS
    this.accelSpeedUncertainty += this.accelDriftRate * dt;
    
    // Kalman gain: how much to trust GPS vs prediction
    // Higher gain = trust GPS more
    const totalUncertainty = this.speedEstimateUncertainty + gpsSpeedUncertainty;
    const kalmanGain = this.speedEstimateUncertainty / Math.max(totalUncertainty, 0.1);
    
    // Update fused speed
    const innovation = this.gpsSpeed - this.fusedSpeed;
    this.fusedSpeed += kalmanGain * innovation;
    
    // Update uncertainty (reduced by measurement)
    this.speedEstimateUncertainty = (1 - kalmanGain) * this.speedEstimateUncertainty;
    
    // === ZERO SPEED ANCHORING ===
    // If GPS consistently shows very low speed, anchor to zero
    if (this.consecutiveZeroGPS >= 3 && this.gpsSpeed < 0.5 && this.gpsReliabilityScore > 0.5) {
      this.fusedSpeed = 0;
      this.accelIntegratedSpeed = 0;
      this.speedEstimateUncertainty = 0.5;
      this.velocity = 0;
    }
    
    // Sync velocity with fused speed
    this.velocity = Math.max(0, this.fusedSpeed);
    
    // Reset accelerometer integration anchor to GPS
    this.accelIntegratedSpeed = this.fusedSpeed;
    this.accelSpeedUncertainty = gpsSpeedUncertainty; // Reset drift
    
    this.lastFusionTime = now;
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

  // Legacy method - now integrated into performSensorFusion
  validateAccelerometerSpeed(gpsSpeed) {
    // This is now handled by performSensorFusion()
    // Keep for compatibility but functionality moved to Kalman-like fusion
    const speedDifference = Math.abs(this.velocity - gpsSpeed);
    const tolerance = Math.max(gpsSpeed * 0.3, 2.0);
    
    if (speedDifference > tolerance) {
      this.velocityConfidence = Math.max(0, this.velocityConfidence - 0.2);
    } else {
      this.velocityConfidence = Math.min(1.0, this.velocityConfidence + 0.1);
    }
  }

  updateMetrics(sensorData) {
    if (!this.runStartTime) return;
    
    const timeElapsed = (sensorData.timestamp - this.runStartTime) / 1000;
    let dt = timeElapsed - this.lastTimestamp;
    
    if (dt <= 0) return;
    
    // Cap dt to prevent huge velocity spikes after screen wake
    // If dt > 0.5 seconds, the app was likely backgrounded/screen locked
    if (dt > 0.5) {
      console.warn(`Large dt detected (${dt.toFixed(2)}s), likely from screen lock. Resetting to GPS.`);
      // Reset to GPS speed instead of zero if GPS is available
      if (this.gpsAvailable && this.gpsReliabilityScore > 0.3) {
        this.velocity = this.gpsSpeed;
        this.fusedSpeed = this.gpsSpeed;
        this.accelIntegratedSpeed = this.gpsSpeed;
      } else {
      this.velocity = 0;
        this.fusedSpeed = 0;
        this.accelIntegratedSpeed = 0;
      }
      this.velocityBuffer = [];
      this.speedEstimateUncertainty = 5; // Reset uncertainty
      this.lastTimestamp = timeElapsed;
      return; // Skip this update entirely
    }
    
    // Additional sanity check for reasonable dt
    dt = Math.min(dt, 0.1); // Cap at 100ms to prevent spikes
    
    const acceleration = sensorData.filteredMagnitude || 0;
    
    // GPS fusion
    const gpsAge = (sensorData.timestamp - this.gpsLastUpdate) / 1000;
    const gpsReliable = this.gpsAvailable && gpsAge < 2.0 && this.gpsReliabilityScore > 0.3;

    // Update stationary duration (REAL TIME TRACKING)
    if (!sensorData.isMoving && acceleration < this.motionThreshold) {
      this.stationaryDuration += dt;
    } else {
      this.stationaryDuration = 0;
    }

    // Rule: If stationary for > 3 seconds AND GPS confirms, force zero and recalibrate
    if (this.stationaryDuration > 3.0 && (!gpsReliable || this.gpsSpeed < 0.5)) {
      if (this.velocity > 0) {
        console.log('Stationary > 3s detected. Forcing zero and recalibrating.');
      }
      this.velocity = 0;
      this.fusedSpeed = 0;
      this.accelIntegratedSpeed = 0;
      this.velocityBuffer = [];
      this.speedEstimateUncertainty = 0.5;
      
      // Recalibrate bias while stationary
      this.recalibrateBias();
      
      this.lastTimestamp = timeElapsed;
      
      // Update display to 0 immediately
      this.elements.speedValue.textContent = '0';
      this.elements.speedSign.classList.remove('moving');
      return;
    }
    
    // === ENHANCED SENSOR FUSION VELOCITY UPDATE ===
    // Between GPS updates, use accelerometer to refine the estimate
    
    // Update accelerometer-integrated speed
    if (sensorData.isMoving && acceleration > this.motionThreshold) {
      const velocityChange = acceleration * dt;
      this.accelIntegratedSpeed += velocityChange;
      
      // Increase uncertainty as we integrate without GPS correction
      this.speedEstimateUncertainty += this.accelDriftRate * dt;
    }
    
    // Determine primary velocity source based on sensor reliability
    if (gpsReliable) {
      // GPS is reliable - weight heavily toward GPS
      // Use accelerometer only for smoothing between GPS updates
      const gpsWeight = Math.min(0.8, 0.5 + this.gpsReliabilityScore * 0.3);
      const accelWeight = 1 - gpsWeight;
      
      // Blend GPS with accelerometer-refined estimate
      this.velocity = gpsWeight * this.gpsSpeed + accelWeight * this.accelIntegratedSpeed;
      this.fusedSpeed = this.velocity;
      
      // Clamp accelerometer estimate toward GPS to prevent drift accumulation
      const accelDrift = Math.abs(this.accelIntegratedSpeed - this.gpsSpeed);
      if (accelDrift > 2.0) { // If accelerometer drifted more than 2 m/s
        // Pull accelerometer estimate back toward GPS
        this.accelIntegratedSpeed = 0.7 * this.accelIntegratedSpeed + 0.3 * this.gpsSpeed;
      }
    } else {
      // GPS is stale or unreliable - use accelerometer with caution
      this.velocity = this.accelIntegratedSpeed;
      this.fusedSpeed = this.velocity;
      
      // Apply velocity decay if no acceleration detected (prevent runaway drift)
      if (!sensorData.isMoving || acceleration < this.motionThreshold * 0.5) {
        this.velocity *= 0.98; // Gentle decay
        this.accelIntegratedSpeed = this.velocity;
        this.fusedSpeed = this.velocity;
      }
    }
    
    // === ZERO SPEED ANCHORING ===
    // Multiple checks to ensure we don't show false speed when stationary
    
    // Check 1: GPS says we're stopped
    if (gpsReliable && this.gpsSpeed < 0.3 && this.consecutiveZeroGPS >= 3) {
      this.velocity = 0;
      this.fusedSpeed = 0;
      this.accelIntegratedSpeed = 0;
      this.velocityBuffer = [];
      this.stationaryDuration += dt;
    }
    
    // Check 2: No significant acceleration and low velocity
    if (!sensorData.isMoving && this.velocity < 2.0) {
      if (gpsReliable && this.gpsSpeed < 1.0) {
        this.velocity = 0;
        this.fusedSpeed = 0;
        this.accelIntegratedSpeed = 0;
      } else if (this.velocity < 0.89) {
        // Tilt rejection threshold: ~2 mph
        this.velocity = 0;
        this.fusedSpeed = 0;
        this.accelIntegratedSpeed = 0;
      }
    }
    
    // Check 3: Periodic distance validation (every 2 seconds)
    if (timeElapsed - this.lastDriftCheckTime > 2.0 && this.gpsDistance > 0 && this.distance > 5) {
      const distanceDiff = Math.abs(this.distance - this.gpsDistance);
      const distanceError = this.distance > 0 ? distanceDiff / this.distance : 0;
      
      // If accelerometer distance is more than 20% off from GPS distance
      if (distanceError > 0.2 && gpsReliable) {
        const correctionFactor = this.gpsDistance / Math.max(this.distance, 0.1);
        this.distance = this.gpsDistance; // Snap to GPS distance
        
        // Also correct velocity toward GPS
        if (correctionFactor < 0.8 || correctionFactor > 1.2) {
          this.velocity = this.gpsSpeed;
          this.fusedSpeed = this.gpsSpeed;
          this.accelIntegratedSpeed = this.gpsSpeed;
        }
        this.velocityBuffer = [];
      }
      
      this.lastDriftCheckTime = timeElapsed;
    }
    
    // Velocity buffer for smoothing display
      this.velocityBuffer.push(this.velocity);
    if (this.velocityBuffer.length > 5) {
        this.velocityBuffer.shift();
      }
      
    // Use median for display smoothing
      if (this.velocityBuffer.length >= 3) {
        const sortedVelocities = [...this.velocityBuffer].sort((a, b) => a - b);
        const medianIndex = Math.floor(sortedVelocities.length / 2);
        this.velocity = sortedVelocities[medianIndex];
    }
    
    // Prevent unrealistic velocity (sanity check - max ~223 mph / 360 kph)
    const maxRealisticSpeed = 100; // m/s
    if (Math.abs(this.velocity) > maxRealisticSpeed) {
      this.velocity = gpsReliable ? this.gpsSpeed : 0;
    }
    
    this.velocity = Math.max(0, this.velocity);
    this.fusedSpeed = this.velocity;
    this.accelIntegratedSpeed = Math.max(0, this.accelIntegratedSpeed);
    
    // Launch detection
    if (!this.launchDetected) {
      this.detectLaunch(acceleration, sensorData.isMoving, timeElapsed);
    }
    
    // Update distance - only when velocity is above threshold
    if (this.velocity > 0.5) {
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

  recalibrateBias() {
    // Need enough data points
    if (this.accelerationBuffer.length < 5) return;
    
    // Calculate mean of recent raw values
    // Using the last 20 frames (or however many are in buffer)
    let sumX = 0, sumY = 0, sumZ = 0;
    let count = 0;
    
    for (const data of this.accelerationBuffer) {
      if (data.raw) {
        sumX += data.raw.x;
        sumY += data.raw.y;
        sumZ += data.raw.z;
        count++;
      }
    }
    
    if (count === 0) return;
    
    // Soft update: adjust offset by the residual error
    // data.raw contains the 'calibrated' values (residuals), so we add them to the offset
    // to zero them out.
    const avgResidualX = sumX / count;
    const avgResidualY = sumY / count;
    const avgResidualZ = sumZ / count;
    
    const blendFactor = 0.1; // Adjust 10% of the error per frame
    
    this.calibrationOffset.x += avgResidualX * blendFactor;
    this.calibrationOffset.y += avgResidualY * blendFactor;
    this.calibrationOffset.z += avgResidualZ * blendFactor;
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
    const unitKey = this.isMetric ? 'kmh' : 'mph';
    const currentVisibleMetrics = this.visibleMetrics[unitKey];
    
    const visibleMetrics = [...this.metricDefinitions.speed, ...this.metricDefinitions.distance]
      .filter(metric => {
        // Filter by unit system first
        const isMetricUnit = metric.label.includes('km/h') || metric.label.includes('1000m');
        if (this.isMetric !== isMetricUnit) {
          return false;
        }
        
        // If user has made selections, respect them
        if (currentVisibleMetrics && currentVisibleMetrics.length > 0) {
          return currentVisibleMetrics.includes(metric.id);
        }
        
        // Default behavior: show non-conditional metrics or achieved conditional metrics
        if (metric.conditional && !metric.recent) {
          return false;
        }
        
        return true;
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

  renderMetricSelection() {
    const unitKey = this.isMetric ? 'kmh' : 'mph';
    const currentVisibleMetrics = this.visibleMetrics[unitKey];
    
    // Get all metrics for current unit
    const allMetrics = [...this.metricDefinitions.speed, ...this.metricDefinitions.distance]
      .filter(metric => {
        const isMetricUnit = metric.label.includes('km/h') || metric.label.includes('1000m');
        return this.isMetric === isMetricUnit;
      });
    
    this.elements.metricSelection.innerHTML = allMetrics.map(metric => {
      // If no selection has been made yet, default to showing non-conditional metrics
      const isChecked = currentVisibleMetrics 
        ? currentVisibleMetrics.includes(metric.id)
        : !metric.conditional;
      
      return `
        <div class="metric-checkbox-item">
          <input 
            type="checkbox" 
            id="metric-${metric.id}" 
            data-metric-id="${metric.id}"
            ${isChecked ? 'checked' : ''}
            onchange="tracker.toggleMetricVisibility('${metric.id}')"
          />
          <label for="metric-${metric.id}">${metric.label}</label>
        </div>
      `;
    }).join('');
  }

  toggleMetricVisibility(metricId) {
    const unitKey = this.isMetric ? 'kmh' : 'mph';
    
    // Get all metrics for current unit
    const allMetricsForUnit = [...this.metricDefinitions.speed, ...this.metricDefinitions.distance]
      .filter(metric => {
        const isMetricUnit = metric.label.includes('km/h') || metric.label.includes('1000m');
        return this.isMetric === isMetricUnit;
      })
      .map(m => m.id);
    
    // Initialize if not set
    if (!this.visibleMetrics[unitKey]) {
      // Start with non-conditional metrics
      this.visibleMetrics[unitKey] = [...this.metricDefinitions.speed, ...this.metricDefinitions.distance]
        .filter(m => {
          const isMetricUnit = m.label.includes('km/h') || m.label.includes('1000m');
          return this.isMetric === isMetricUnit && !m.conditional;
        })
        .map(m => m.id);
    }
    
    // Toggle the metric
    const index = this.visibleMetrics[unitKey].indexOf(metricId);
    if (index > -1) {
      this.visibleMetrics[unitKey].splice(index, 1);
    } else {
      this.visibleMetrics[unitKey].push(metricId);
    }
    
    // Save to localStorage
    localStorage.setItem(`visibleMetrics_${unitKey}`, JSON.stringify(this.visibleMetrics[unitKey]));
    
    // Re-render metrics
    this.renderMetrics();
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
      ctx.strokeStyle = '#FF3B30'; // Red color
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
    this.renderMetricSelection(); // Update metric selection for new units
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
    
    // Reset all velocity and sensor fusion state
    this.velocity = 0;
    this.fusedSpeed = 0;
    this.accelIntegratedSpeed = 0;
    this.speedEstimateUncertainty = 10;
    this.accelSpeedUncertainty = 0;
    this.distance = 0;
    this.gpsDistance = 0;
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

