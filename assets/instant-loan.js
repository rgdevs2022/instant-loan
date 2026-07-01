/* ============================================================
   INSTANT LOAN — Services, Mock Data & UI Controller
   Subdomain build: instantloan.mycashbridge.com
   All shared assets (logos etc.) resolved from MCB_SITE.
   ============================================================ */
(function () {
  "use strict";

  /* Paths — self-contained for subdomain deployment */
  var BASE     = "";
  var MCB_SITE = ""; /* logos and assets are served locally */

  /* ============================================================
     MOCK BANK DATA
     ============================================================ */
  var MOCK_BANKS = [
    { id:"hdfc",     name:"HDFC Bank",           logo:MCB_SITE+"assets/logos/logo-hdfc.png",                                    baseRate:18.00, maxAmount:300000, minAmount:10000, processingFeeRange:[1.5,2.5], tenureOptions:[12,18,24,36], featured:true  },
    { id:"icici",    name:"ICICI Bank",           logo:MCB_SITE+"assets/logos/icic bank logo.png",                               baseRate:19.50, maxAmount:300000, minAmount:10000, processingFeeRange:[2.0,3.0], tenureOptions:[12,18,24,36], featured:true  },
    { id:"axis",     name:"Axis Bank",            logo:MCB_SITE+"assets/logos/axis bank logo.jpg",                              baseRate:21.00, maxAmount:250000, minAmount:10000, processingFeeRange:[2.0,3.5], tenureOptions:[12,18,24,36], featured:true  },
    { id:"kotak",    name:"Kotak Mahindra Bank",  logo:MCB_SITE+"assets/logos/kotak mahindra bank.jpg",                         baseRate:22.00, maxAmount:300000, minAmount:10000, processingFeeRange:[1.5,2.5], tenureOptions:[12,24,36],    featured:true  },
    { id:"idfc",     name:"IDFC FIRST Bank",      logo:MCB_SITE+"assets/logos/idfc first bank.jpg",                            baseRate:24.00, maxAmount:250000, minAmount:10000, processingFeeRange:[2.0,4.0], tenureOptions:[12,18,24,36], featured:true  },
    { id:"federal",  name:"Federal Bank",         logo:MCB_SITE+"assets/logos/federal bank.jpg",                               baseRate:28.00, maxAmount:200000, minAmount:10000, processingFeeRange:[2.5,4.0], tenureOptions:[12,18,24],    featured:false },
    { id:"indusind", name:"IndusInd Bank",        logo:MCB_SITE+"assets/logos/indusind-bank-logo-png_seeklogo-71354.png",       baseRate:30.00, maxAmount:200000, minAmount:10000, processingFeeRange:[3.0,4.25],tenureOptions:[12,18,24],    featured:false },
    { id:"yes",      name:"YES Bank",             logo:MCB_SITE+"assets/logos/Yes_Bank_Logo_in_2024.png",                      baseRate:36.00, maxAmount:150000, minAmount:10000, processingFeeRange:[3.0,4.25],tenureOptions:[12,18,24],    featured:false }
  ];

  /* ============================================================
     OTP SERVICE
     Future: sendOTP → POST /api/otp/send | verifyOTP → POST /api/otp/verify
     ============================================================ */
  var OtpService = {
    MOCK_OTP: "123456",
    sendOTP: function(mobile) {
      return new Promise(function(resolve) { setTimeout(function(){ resolve({success:true,message:"OTP sent successfully."}); },900); });
    },
    verifyOTP: function(mobile,otp) {
      return new Promise(function(resolve) { setTimeout(function(){ resolve(otp===OtpService.MOCK_OTP?{success:true,message:"Verified."}:{success:false,message:"Invalid OTP. Please try again."}); },700); });
    },
    resendOTP: function(mobile) { return OtpService.sendOTP(mobile); }
  };

  /* ============================================================
     ELIGIBILITY SERVICE
     Future: → POST /api/eligibility/check { ...profile }
     ============================================================ */
  var EligibilityService = {
    checkEligibility: function(profile) {
      return new Promise(function(resolve){ setTimeout(function(){ resolve({offers:EligibilityService._generateOffers(profile)}); },2500); });
    },
    _deterministic: function(seed,min,max){ var v=((seed*9301+49297)%233280)/233280; return min+v*(max-min); },
    _calcEmi: function(principal,annualRate,months){ var r=annualRate/12/100; if(r===0)return Math.round(principal/months); return Math.round(principal*r*Math.pow(1+r,months)/(Math.pow(1+r,months)-1)); },
    _generateOffers: function(profile) {
      var income=parseInt(profile.monthlyIncome,10)||30000;
      var requestedAmount=parseInt(profile.loanAmount,10)||100000;
      var isSalaried=profile.employmentType==="Salaried";
      var multiplier=isSalaried?20:14;
      var maxByIncome=income*multiplier;
      var offers=MOCK_BANKS.map(function(bank){
        var seed=0; for(var i=0;i<bank.name.length;i++) seed+=bank.name.charCodeAt(i);
        var cap=Math.min(maxByIncome,bank.maxAmount,requestedAmount*1.2);
        var rawAmt=cap-EligibilityService._deterministic(seed+1,0,30000);
        var eligibleAmount=Math.max(bank.minAmount,Math.round(rawAmt/5000)*5000);
        var rateVariance=EligibilityService._deterministic(seed+2,0,1.25);
        var interestRate=parseFloat((bank.baseRate+rateVariance).toFixed(2));
        var tenureIdx=Math.floor(EligibilityService._deterministic(seed+3,0,bank.tenureOptions.length-0.01));
        var tenureMonths=bank.tenureOptions[Math.min(tenureIdx,bank.tenureOptions.length-1)];
        if(income>50000&&bank.tenureOptions.length>2) tenureMonths=bank.tenureOptions[bank.tenureOptions.length-2];
        var feeRatio=EligibilityService._deterministic(seed+4,bank.processingFeeRange[0],bank.processingFeeRange[1]);
        var processingFee=Math.max(500,Math.round(eligibleAmount*feeRatio/100/100)*100);
        var monthlyEmi=EligibilityService._calcEmi(eligibleAmount,interestRate,tenureMonths);
        return {bankId:bank.id,bankName:bank.name,logo:bank.logo,eligibleAmount:eligibleAmount,interestRate:interestRate,tenureMonths:tenureMonths,processingFee:processingFee,monthlyEmi:monthlyEmi,featured:bank.featured,tag:""};
      });
      offers.sort(function(a,b){ var d=a.interestRate-b.interestRate; return Math.abs(d)>0.01?d:b.eligibleAmount-a.eligibleAmount; });
      if(offers.length>0) offers[0].tag="Best Offer";
      if(offers.length>1) offers[1].tag="Lowest Rate";
      return offers;
    }
  };

  /* ============================================================
     APPLICATION SERVICE
     Future: → POST /api/application/submit
     ============================================================ */
  var ApplicationService = {
    submit: function(application) {
      return new Promise(function(resolve){
        setTimeout(function(){
          var ts=Date.now();
          var appId="MCB"+new Date().getFullYear()+String(ts).slice(-5);
          try {
            var store=JSON.parse(localStorage.getItem("il_applications")||"{}");
            store[appId]={applicationId:appId,mobile:application.mobile,bank:application.selectedOffer?application.selectedOffer.bankName:"MyCashBridge",status:"Submitted",createdAt:ts,profile:application.profile,offer:application.selectedOffer};
            localStorage.setItem("il_applications",JSON.stringify(store));
          } catch(e){}
          resolve({success:true,applicationId:appId,status:"Submitted",bank:application.selectedOffer?application.selectedOffer.bankName:"MyCashBridge",estimatedCallback:"30 minutes \u2013 2 hours*"});
        },1100);
      });
    }
  };

  /* ============================================================
     LOAN SERVICE (Track)
     Future: → GET /api/application/status?appId=&mobile=
     ============================================================ */
  var LoanService = {
    getStatus: function(appId,mobile) {
      return new Promise(function(resolve,reject){
        setTimeout(function(){
          if(!appId||!mobile){ reject(new Error("Please enter your Application ID and mobile number.")); return; }
          var stored=null;
          try { var store=JSON.parse(localStorage.getItem("il_applications")||"{}"); stored=store[appId]||null; } catch(e){}
          var mobileClean=mobile.replace(/\D/g,"").slice(-10);
          if(stored&&stored.mobile.slice(-10)!==mobileClean){ reject(new Error("Application ID and mobile number do not match.")); return; }
          var bankName=stored?stored.bank:"HDFC Bank";
          resolve({
            applicationId:appId, mobile:mobile, bank:bankName, currentStage:"Verification Pending",
            stages:[
              {key:"submitted",   label:"Application Submitted",icon:"send",       done:true, active:false,date:"Today"},
              {key:"received",    label:"Bank Received",        icon:"landmark",   done:true, active:false,date:"Today"},
              {key:"verification",label:"Verification Pending", icon:"scan-search",done:false,active:true, date:"In progress \u2014 30 min to 2 hrs*"},
              {key:"review",      label:"Under Review",         icon:"file-search",done:false,active:false,date:"Pending"},
              {key:"approved",    label:"Approved",             icon:"badge-check",done:false,active:false,date:"Pending"},
              {key:"disbursed",   label:"Disbursed",            icon:"banknote",   done:false,active:false,date:"Within 30 min \u2013 2 hrs*"}
            ]
          });
        },1200);
      });
    }
  };

  /* ============================================================
     UTILITIES
     ============================================================ */
  function inr(n){ return "\u20B9"+Math.round(n).toLocaleString("en-IN"); }
  function relucide(){ if(window.lucide) window.lucide.createIcons(); }
  function qs(sel,root){ return (root||document).querySelector(sel); }
  function isValidMobile(v){ return /^[6-9]\d{9}$/.test(v.trim()); }
  function isValidPincode(v){ return /^\d{6}$/.test(v.trim()); }

  /* ============================================================
     INSTANT LOAN APP — UI CONTROLLER
     ============================================================ */
  var App = {
    TOTAL_STEPS: 5,
    state: { currentStep:1, mobile:"", profile:null, offers:[], selectedOffer:null, application:null, consents:{terms:false,privacy:false,sharing:false} },

    init: function() { var page=qs(".il-app"); if(!page) return; this.renderStep(1); this.bindGlobal(); },

    updateProgress: function(step) {
      var bars=document.querySelectorAll(".il-progress-step");
      var labels=document.querySelectorAll(".il-step-label span");
      bars.forEach(function(bar,idx){ bar.classList.remove("done","active"); if(idx+1<step) bar.classList.add("done"); else if(idx+1===step) bar.classList.add("active"); });
      if(labels.length){ labels.forEach(function(l){ l.classList.remove("current"); }); if(labels[step-1]) labels[step-1].classList.add("current"); }
    },

    renderStep: function(step) {
      this.state.currentStep=step;
      document.querySelectorAll(".il-panel").forEach(function(p){ p.classList.remove("active"); });
      var target=qs(".il-panel[data-step='"+step+"']");
      if(target) target.classList.add("active");
      this.updateProgress(step);
      var card=qs(".il-card");
      if(card) card.scrollIntoView({behavior:"smooth",block:"nearest"});
    },

    initStep1: function() {
      var self=this;
      var mobileInput=qs("#il-mobile"), continueBtn=qs("#il-step1-btn"), indicator=qs("#il-mobile-indicator");
      if(!mobileInput||!continueBtn) return;
      function updateBtn(){ var valid=isValidMobile(mobileInput.value); continueBtn.disabled=!valid; if(indicator){ indicator.innerHTML=valid?'<i data-lucide="check-circle-2" style="color:var(--green-accent)"></i>':""; relucide(); } }
      mobileInput.addEventListener("input",function(){ this.value=this.value.replace(/\D/g,"").slice(0,10); updateBtn(); qs("#il-mobile-field").classList.remove("invalid"); });
      continueBtn.addEventListener("click",function(){
        if(!isValidMobile(mobileInput.value)){ qs("#il-mobile-field").classList.add("invalid"); mobileInput.focus(); return; }
        self.state.mobile=mobileInput.value.trim();
        var label=continueBtn.querySelector(".il-btn-label");
        if(label) label.innerHTML='<span class="il-btn-spin"></span> Sending OTP\u2026';
        continueBtn.disabled=true;
        OtpService.sendOTP(self.state.mobile).then(function(res){
          if(label) label.innerHTML='<i data-lucide="arrow-right"></i> Get My Loan Offers';
          continueBtn.disabled=false;
          if(res.success){ self.renderStep(2); setTimeout(function(){ self.initStep2(); },50); }
          relucide();
        }).catch(function(){ if(label) label.innerHTML='<i data-lucide="arrow-right"></i> Get My Loan Offers'; continueBtn.disabled=false; relucide(); });
      });
      mobileInput.addEventListener("keydown",function(e){ if(e.key==="Enter") continueBtn.click(); });
    },

    initStep2: function() {
      var self=this;
      var boxes=document.querySelectorAll(".il-otp-box"), verifyBtn=qs("#il-step2-btn");
      var statusEl=qs("#il-otp-status"), resendBtn=qs("#il-otp-resend"), countdownEl=qs("#il-otp-countdown");
      var mobileDisplay=qs("#il-otp-mobile");
      if(!boxes.length||!verifyBtn) return;
      if(mobileDisplay) mobileDisplay.textContent="+91 "+self.state.mobile;
      if(statusEl){ statusEl.className="il-otp-status success"; statusEl.textContent="OTP sent successfully."; }
      var countdown=30, timerInterval=null;
      function startCountdown(){ countdown=30; if(resendBtn) resendBtn.disabled=true; if(timerInterval) clearInterval(timerInterval); timerInterval=setInterval(function(){ countdown--; if(countdownEl) countdownEl.textContent=countdown+"s"; if(countdown<=0){ clearInterval(timerInterval); if(resendBtn) resendBtn.disabled=false; if(countdownEl) countdownEl.textContent=""; } },1000); }
      startCountdown();
      function getOtpValue(){ var v=""; boxes.forEach(function(b){ v+=b.value||""; }); return v; }
      function clearErrors(){ boxes.forEach(function(b){ b.classList.remove("error"); }); if(statusEl){ statusEl.className="il-otp-status"; statusEl.textContent=""; } }
      function setError(msg){ boxes.forEach(function(b){ b.classList.add("error"); }); if(statusEl){ statusEl.className="il-otp-status error"; statusEl.textContent=msg||"Invalid OTP."; } }
      function setSuccess(){ boxes.forEach(function(b){ b.classList.remove("error"); b.classList.add("filled","success-pop"); }); if(statusEl){ statusEl.className="il-otp-status success"; statusEl.textContent="OTP verified!"; } }
      boxes.forEach(function(box,idx){
        box.addEventListener("input",function(e){ clearErrors(); var v=e.target.value.replace(/\D/g,""); e.target.value=v.slice(-1); if(v){ e.target.classList.add("filled"); if(idx<boxes.length-1) boxes[idx+1].focus(); } else e.target.classList.remove("filled"); if(getOtpValue().length===6) verifyBtn.click(); });
        box.addEventListener("keydown",function(e){ if(e.key==="Backspace"&&!e.target.value&&idx>0){ boxes[idx-1].value=""; boxes[idx-1].classList.remove("filled"); boxes[idx-1].focus(); } if(e.key==="ArrowLeft"&&idx>0) boxes[idx-1].focus(); if(e.key==="ArrowRight"&&idx<boxes.length-1) boxes[idx+1].focus(); });
        box.addEventListener("paste",function(e){ e.preventDefault(); var p=(e.clipboardData||window.clipboardData).getData("text").replace(/\D/g,"").slice(0,6); p.split("").forEach(function(ch,i){ if(boxes[i]){ boxes[i].value=ch; boxes[i].classList.add("filled"); } }); boxes[Math.min(p.length,boxes.length-1)].focus(); if(getOtpValue().length===6) setTimeout(function(){ verifyBtn.click(); },150); });
      });
      setTimeout(function(){ if(boxes[0]) boxes[0].focus(); },200);
      verifyBtn.addEventListener("click",function(){
        var otp=getOtpValue();
        if(otp.length<6){ setError("Please enter the 6-digit OTP."); if(boxes[otp.length]) boxes[otp.length].focus(); return; }
        var label=verifyBtn.querySelector(".il-btn-label");
        if(label) label.innerHTML='<span class="il-btn-spin"></span> Verifying\u2026';
        verifyBtn.disabled=true;
        OtpService.verifyOTP(self.state.mobile,otp).then(function(res){
          if(res.success){ setSuccess(); if(label) label.innerHTML='<i data-lucide="check"></i> Verified!'; relucide(); setTimeout(function(){ self.renderStep(3); setTimeout(function(){ self.initStep3(); },50); },700); }
          else { setError(res.message||"Invalid OTP."); if(label) label.innerHTML='<i data-lucide="shield-check"></i> Verify OTP'; verifyBtn.disabled=false; relucide(); setTimeout(function(){ boxes.forEach(function(b){ b.value=""; b.classList.remove("filled","error"); }); if(boxes[0]) boxes[0].focus(); },1200); }
        }).catch(function(){ setError("Something went wrong. Please try again."); if(label) label.innerHTML='<i data-lucide="shield-check"></i> Verify OTP'; verifyBtn.disabled=false; relucide(); });
      });
      if(resendBtn){ resendBtn.addEventListener("click",function(){ clearErrors(); boxes.forEach(function(b){ b.value=""; b.classList.remove("filled","error"); }); resendBtn.disabled=true; if(statusEl){ statusEl.className="il-otp-status"; statusEl.textContent="Sending\u2026"; } OtpService.resendOTP(self.state.mobile).then(function(res){ if(statusEl){ statusEl.className="il-otp-status success"; statusEl.textContent=res.message||"OTP resent."; } startCountdown(); if(boxes[0]) boxes[0].focus(); }).catch(function(){ if(statusEl){ statusEl.className="il-otp-status error"; statusEl.textContent="Could not resend. Try again."; } resendBtn.disabled=false; }); }); }
    },

    initStep3: function() {
      var self=this;
      var form=qs("#il-step3-form"), amountInput=qs("#il-loan-amount"), amountDisplay=qs("#il-amount-display"), submitBtn=qs("#il-step3-btn");
      if(!form) return;
      if(amountInput&&amountDisplay){ amountInput.addEventListener("input",function(){ amountDisplay.textContent=inr(parseInt(this.value,10)); }); amountDisplay.textContent=inr(parseInt(amountInput.value,10)); }
      var empOpts=form.querySelectorAll(".il-seg-opt"), empHidden=qs("#il-employment");
      empOpts.forEach(function(opt){ opt.addEventListener("click",function(){ empOpts.forEach(function(o){ o.classList.remove("sel"); }); this.classList.add("sel"); if(empHidden) empHidden.value=this.getAttribute("data-val"); var f=qs("#il-employment-field"); if(f) f.classList.remove("invalid"); }); });
      function markValid(id){ var f=qs("#"+id); if(f){ f.classList.remove("invalid"); f.classList.add("valid"); } }
      function markInvalid(id){ var f=qs("#"+id); if(f){ f.classList.remove("valid"); f.classList.add("invalid"); } }
      function clearMark(id){ var f=qs("#"+id); if(f) f.classList.remove("valid","invalid"); }
      var incomeInput=qs("#il-income"); if(incomeInput) incomeInput.addEventListener("input",function(){ this.value=this.value.replace(/\D/g,""); clearMark("il-income-field"); });
      var pincodeInput=qs("#il-pincode"); if(pincodeInput) pincodeInput.addEventListener("input",function(){ this.value=this.value.replace(/\D/g,"").slice(0,6); clearMark("il-pincode-field"); });
      var nameInput=qs("#il-name"); if(nameInput) nameInput.addEventListener("input",function(){ clearMark("il-name-field"); });
      function validate(){
        var ok=true;
        var name=(nameInput&&nameInput.value.trim())||""; if(name.length<3){ markInvalid("il-name-field"); ok=false; } else markValid("il-name-field");
        var amount=amountInput?parseInt(amountInput.value,10):0; if(amount<10000||amount>300000){ markInvalid("il-amount-field"); ok=false; }
        var empVal=empHidden?empHidden.value:""; if(!empVal){ markInvalid("il-employment-field"); ok=false; }
        var income=incomeInput?parseInt(incomeInput.value,10):0; if(!income||income<15000){ markInvalid("il-income-field"); ok=false; } else markValid("il-income-field");
        var pincode=pincodeInput?pincodeInput.value.trim():""; if(!isValidPincode(pincode)){ markInvalid("il-pincode-field"); ok=false; } else markValid("il-pincode-field");
        return ok;
      }
      if(submitBtn){ submitBtn.addEventListener("click",function(){ if(!validate()){ var f=form.querySelector(".il-field.invalid input,.il-field.invalid select"); if(f) f.focus(); return; } self.state.profile={fullName:nameInput?nameInput.value.trim():"",loanAmount:amountInput?parseInt(amountInput.value,10):100000,employmentType:empHidden?empHidden.value:"Salaried",monthlyIncome:incomeInput?parseInt(incomeInput.value,10):30000,pincode:pincodeInput?pincodeInput.value.trim():""}; self.renderStep(4); setTimeout(function(){ self.initStep4(); },50); }); }
    },

    initStep4: function() {
      var self=this;
      EligibilityService.checkEligibility(self.state.profile).then(function(res){ self.state.offers=res.offers; self.renderOffers(); }).catch(function(){ var loaderEl=qs(".il-loader"); if(loaderEl){ loaderEl.innerHTML='<div style="text-align:center;padding:16px"><p style="color:var(--red);font-weight:600;margin-bottom:12px">Could not fetch offers. Please try again.</p><button class="btn btn-outline" id="il-retry-offers">Retry</button></div>'; var r=qs("#il-retry-offers"); if(r) r.addEventListener("click",function(){ self.initStep4(); }); } });
    },

    renderOffers: function() {
      var self=this;
      var step4Panel=qs(".il-panel[data-step='4']");
      if(!step4Panel) return;
      step4Panel.innerHTML=self._offersHTML();
      relucide();
      var cards=step4Panel.querySelectorAll(".il-offer-card");
      cards.forEach(function(card){ card.addEventListener("click",function(){ cards.forEach(function(c){ c.classList.remove("selected"); }); card.classList.add("selected"); self.state.selectedOffer=self.state.offers[parseInt(card.getAttribute("data-offer-idx"),10)]; }); });
      step4Panel.querySelectorAll(".il-offer-apply").forEach(function(btn){ btn.addEventListener("click",function(e){ e.stopPropagation(); var idx=parseInt(btn.getAttribute("data-offer-idx"),10); self.state.selectedOffer=self.state.offers[idx]; cards.forEach(function(c){ c.classList.remove("selected"); }); var card=step4Panel.querySelector(".il-offer-card[data-offer-idx='"+idx+"']"); if(card) card.classList.add("selected"); self.renderStep(5); setTimeout(function(){ self.initStep5(); },50); }); });
      if(cards[0]){ cards[0].classList.add("selected"); self.state.selectedOffer=self.state.offers[0]; }
    },

    _offersHTML: function() {
      var self=this, offers=self.state.offers, profile=self.state.profile;
      var requestedAmt=profile?inr(profile.loanAmount):"";
      var html='<div class="il-panel-head"><h2>Your personalised offers</h2><p>Matched across <strong>128+ lenders</strong>. Select the offer that fits your budget and tap <strong>Apply Now</strong>.</p></div>'+
        '<div class="il-offers-header"><span class="il-offers-count">Showing top <b>'+offers.length+' offers</b> matched to your profile</span>'+(requestedAmt?'<span style="font-size:12px;color:var(--text-soft)">Requested: <b style="color:var(--text-strong)">'+requestedAmt+'</b></span>':'')+
        '</div><div class="il-offer-list">';
      offers.forEach(function(offer,idx){
        var logoHtml=offer.logo?'<img class="il-offer-logo" src="'+offer.logo+'" alt="'+offer.bankName+'" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><div class="il-offer-logo-fallback" style="display:none">'+offer.bankName.slice(0,4)+'</div>':'<div class="il-offer-logo-fallback">'+offer.bankName.slice(0,4)+'</div>';
        var totalInterest=Math.round((offer.monthlyEmi*offer.tenureMonths)-offer.eligibleAmount);
        html+='<div class="il-offer-card" data-offer-idx="'+idx+'">'+(offer.tag?'<span class="il-offer-tag">'+offer.tag+'</span>':'')+
          '<div class="il-offer-top">'+logoHtml+'<div class="il-offer-bank-info"><span class="il-offer-bank-name">'+offer.bankName+'</span><span class="il-offer-bank-type">Bank &bull; RBI Regulated</span></div><div class="il-offer-select-radio" aria-hidden="true"></div></div>'+
          '<div class="il-offer-grid"><div class="il-offer-stat il-offer-stat-primary"><span class="v">'+inr(offer.eligibleAmount)+'</span><span class="k">You can get</span></div><div class="il-offer-stat"><span class="v">'+offer.interestRate+'% <span style="font-size:11px;font-weight:600">p.a.</span></span><span class="k">Interest rate</span></div><div class="il-offer-stat"><span class="v">'+inr(offer.monthlyEmi)+'<span style="font-size:11px;font-weight:600">/mo</span></span><span class="k">EMI for '+offer.tenureMonths+' mo</span></div><div class="il-offer-stat"><span class="v">'+inr(offer.processingFee)+'</span><span class="k">Processing fee</span></div></div>'+
          '<div class="il-offer-details"><span class="il-offer-detail-item"><i data-lucide="clock"></i> '+offer.tenureMonths+' months tenure</span><span class="il-offer-detail-item"><i data-lucide="trending-up"></i> Total interest ~'+inr(totalInterest)+'</span></div>'+
          '<div class="il-offer-cta"><button class="btn btn-filled btn-block il-offer-apply" data-offer-idx="'+idx+'"><i data-lucide="arrow-right"></i> Apply Now &mdash; Free</button></div></div>';
      });
      html+='</div><p style="font-size:11px;color:var(--text-soft);margin:14px 0 8px;line-height:1.5">Offers are indicative. Final rate and amount are determined by the lender after credit assessment.</p>'+
        '<div class="il-trust-row"><span class="il-trust-item"><i data-lucide="shield-check"></i> No CIBIL impact</span><span class="il-trust-item"><i data-lucide="lock"></i> 256-bit secure</span><span class="il-trust-item"><i data-lucide="landmark"></i> RBI regulated</span><span class="il-trust-item"><i data-lucide="badge-check"></i> Free to apply</span></div>';
      return html;
    },

    initStep5: function() {
      var self=this;
      var bankSummary=qs("#il-selected-bank-summary");
      if(bankSummary&&self.state.selectedOffer){ var o=self.state.selectedOffer; bankSummary.innerHTML='<div class="il-selected-bank">'+(o.logo?'<img class="il-selected-bank-logo" src="'+o.logo+'" alt="'+o.bankName+'" onerror="this.style.display=\'none\'">':'')+
        '<div class="il-selected-bank-info"><span class="il-selected-bank-name">'+o.bankName+'</span><span class="il-selected-bank-meta">'+inr(o.eligibleAmount)+' at '+o.interestRate+'% p.a. &bull; EMI '+inr(o.monthlyEmi)+'/mo</span></div><button class="il-change-btn" id="il-change-bank">Change</button></div>';
        var changeBtn=qs("#il-change-bank"); if(changeBtn) changeBtn.addEventListener("click",function(){ self.renderStep(4); setTimeout(function(){ self.renderOffers(); },50); }); }
      document.querySelectorAll(".il-consent-item[data-consent]").forEach(function(item){ item.addEventListener("click",function(){ var key=item.getAttribute("data-consent"); item.classList.toggle("checked"); self.state.consents[key]=item.classList.contains("checked"); var e=qs(".il-consent-err"); if(e) e.classList.remove("show"); }); });
      var submitBtn=qs("#il-step5-btn");
      if(submitBtn){ submitBtn.addEventListener("click",function(){
        if(!self.state.consents.terms||!self.state.consents.privacy||!self.state.consents.sharing){ var err=qs(".il-consent-err"); if(err) err.classList.add("show"); return; }
        var label=submitBtn.querySelector(".il-btn-label");
        if(label) label.innerHTML='<span class="il-btn-spin"></span> Submitting\u2026';
        submitBtn.disabled=true;
        ApplicationService.submit({mobile:self.state.mobile,profile:self.state.profile,selectedOffer:self.state.selectedOffer}).then(function(result){ self.state.application=result; self.renderStep(6); setTimeout(function(){ self.initStep6(); },50); }).catch(function(){ if(label) label.innerHTML='<i data-lucide="send"></i> Submit Application'; submitBtn.disabled=false; relucide(); });
      }); }
    },

    initStep6: function() {
      var result=this.state.application, offer=this.state.selectedOffer;
      if(!result) return;
      var appIdEl=qs("#il-app-id"); if(appIdEl) appIdEl.textContent=result.applicationId;
      var bankEl=qs("#il-app-bank"); if(bankEl) bankEl.textContent=result.bank;
      var rateEl=qs("#il-app-rate"); if(rateEl) rateEl.textContent=offer?offer.interestRate+"% p.a.":"\u2014";
      var amountEl=qs("#il-app-amount"); if(amountEl) amountEl.textContent=offer?inr(offer.eligibleAmount):"\u2014";
      var callbackEl=qs("#il-app-callback"); if(callbackEl) callbackEl.textContent="30 min \u2013 2 hrs*";
      var disbursalEl=qs("#il-app-disbursal"); if(disbursalEl) disbursalEl.textContent="30 min \u2013 2 hrs*";
      var dateEl=qs("#il-app-date"); if(dateEl){ var d=new Date(); dateEl.textContent=d.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}); }
      var nextSteps=["A MyCashBridge expert will call you within 30 minutes to 2 hours to guide you through the next steps.","Keep your Aadhaar, PAN, last 3 salary slips, and latest 6-month bank statement ready.","After document verification, the lender will issue a formal sanction letter for your review.","Once you sign the agreement, funds are typically disbursed within <strong>30 minutes to 2 hours</strong> for pre-approved profiles.*"];
      var nextEl=qs("#il-next-steps-list"); if(nextEl) nextEl.innerHTML=nextSteps.map(function(step,idx){ return '<div class="il-next-step"><span class="il-step-num">'+(idx+1)+'</span><span>'+step+'</span></div>'; }).join("");
      var trackBtn=qs("#il-track-btn"); if(trackBtn) trackBtn.setAttribute("href","track.html?appId="+encodeURIComponent(result.applicationId)+"&mobile="+encodeURIComponent(this.state.mobile));
      this._confetti();
      relucide();
    },

    _confetti: function() {
      var container=qs("#il-confetti"); if(!container) return;
      var colors=["#9AEF5E","#cba258","#0c7a4e","#7fe06a","#e0fced","#fbbc05"];
      for(var i=0;i<32;i++){ var s=document.createElement("i"); s.style.cssText=["position:absolute","left:"+(Math.random()*100)+"%","top:-14px","width:"+(6+Math.random()*8)+"px","height:"+(6+Math.random()*8)+"px","background:"+colors[i%colors.length],"border-radius:"+(Math.random()>0.5?"50%":"2px"),"animation:cbFall "+(0.9+Math.random()*0.8)+"s "+(Math.random()*0.4)+"s ease-in forwards","transform:rotate("+(Math.random()*360|0)+"deg)"].join(";"); container.appendChild(s); }
    },

    bindGlobal: function() {
      var self=this;
      self.initStep1();
      document.addEventListener("click",function(e){ if(e.target.closest("#il-back-btn")){ var prev=self.state.currentStep-1; if(prev>=1){ self.renderStep(prev); if(prev===1) self.initStep1(); else if(prev===2) setTimeout(function(){ self.initStep2(); },50); else if(prev===3) setTimeout(function(){ self.initStep3(); },50); } } });
    }
  };

  /* ============================================================
     TRACK APP PAGE CONTROLLER
     ============================================================ */
  var TrackApp = {
    init: function() {
      var page=qs(".il-track-page"); if(!page) return;
      var params=new URLSearchParams(location.search);
      var appIdInput=qs("#track-app-id"), mobileInput=qs("#track-mobile");
      var appIdParam=params.get("appId"), mobileParam=params.get("mobile");
      if(appIdInput&&appIdParam) appIdInput.value=appIdParam;
      if(mobileInput&&mobileParam) mobileInput.value=mobileParam;
      if(appIdParam&&mobileParam) setTimeout(function(){ TrackApp.doTrack(appIdParam,mobileParam); },400);
      var trackBtn=qs("#track-btn");
      if(trackBtn){ trackBtn.addEventListener("click",function(){ var appId=appIdInput?appIdInput.value.trim():""; var mobile=mobileInput?mobileInput.value.replace(/\D/g,"").slice(-10):""; if(!appId){ if(appIdInput) appIdInput.focus(); return; } if(!mobile||!isValidMobile(mobile)){ if(mobileInput) mobileInput.focus(); return; } TrackApp.doTrack(appId,mobile); }); }
      if(mobileInput) mobileInput.addEventListener("input",function(){ this.value=this.value.replace(/\D/g,"").slice(0,10); });
    },
    doTrack: function(appId,mobile) {
      var trackBtn=qs("#track-btn"), resultEl=qs("#track-result"), errorEl=qs("#track-error");
      if(errorEl) errorEl.style.display="none"; if(resultEl) resultEl.style.display="none";
      if(trackBtn){ var lbl=trackBtn.querySelector(".il-btn-label"); if(lbl) lbl.innerHTML='<span class="il-btn-spin"></span> Tracking\u2026'; trackBtn.disabled=true; }
      LoanService.getStatus(appId,mobile).then(function(data){ if(trackBtn){ var lbl=trackBtn.querySelector(".il-btn-label"); if(lbl) lbl.innerHTML='<i data-lucide="search"></i> Track Status'; trackBtn.disabled=false; relucide(); } TrackApp.renderResult(data); }).catch(function(err){ if(trackBtn){ var lbl=trackBtn.querySelector(".il-btn-label"); if(lbl) lbl.innerHTML='<i data-lucide="search"></i> Track Status'; trackBtn.disabled=false; relucide(); } if(errorEl){ errorEl.textContent=err&&err.message?err.message:"Application not found. Please check your details."; errorEl.style.display="block"; } });
    },
    renderResult: function(data) {
      var resultEl=qs("#track-result"); if(!resultEl) return;
      var timelineHTML=data.stages.map(function(stage){ var cls=stage.done?"done":(stage.active?"active":""); var icon=stage.done?"check":(stage.active?"loader-2":"circle"); return '<div class="il-timeline-item '+cls+'"><div class="il-timeline-left"><div class="il-timeline-dot"><i data-lucide="'+icon+'"></i></div>'+(stage.key!=="disbursed"?'<div class="il-timeline-line"></div>':'')+
        '</div><div class="il-timeline-content"><div class="il-timeline-label">'+stage.label+'</div><div class="il-timeline-date">'+stage.date+'</div></div></div>'; }).join("");
      resultEl.innerHTML='<div class="card" style="margin-bottom:24px"><div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:12px;margin-bottom:16px"><div><span class="eyebrow">Application ID</span><div style="font-size:20px;font-weight:800;color:var(--green-primary);font-family:monospace;margin-top:4px">'+data.applicationId+'</div></div><span class="pill pill-approved"><i data-lucide="check-circle-2"></i> '+data.currentStage+'</span></div><div style="font-size:14px;color:var(--text-soft)">Bank: <b style="color:var(--text-strong)">'+data.bank+'</b></div></div>'+
        '<div class="card"><h3 style="font-size:18px;font-weight:700;margin:0 0 20px;color:var(--text-strong)">Application Timeline</h3><div class="il-timeline">'+timelineHTML+'</div></div>'+
        '<div style="margin-top:16px;text-align:center"><a href="index.html" class="btn btn-outline">Apply for another loan</a></div>';
      resultEl.style.display="block"; relucide();
    }
  };

  function boot(){ App.init(); TrackApp.init(); }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot); else boot();
})();
