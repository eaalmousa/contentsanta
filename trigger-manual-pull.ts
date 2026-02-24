import fetch from 'node-fetch';

(async () => {
  console.log('\n🔄 Triggering WordPress manual pull...\n');
  
  try {
    const response = await fetch('https://inert-nonblamefully-dillon.ngrok-free.dev/api/wp/pull', {
      headers: {
        'X-ContentSanta-Secret': 'cs_sec_bBH5KhmyT_Tmgpy5EwTrGWzE0WQzpRFpZHmWKnogOtg'
      }
    });
    
    const data = await response.json();
    
    if (data.jobs && data.jobs.length > 0) {
      console.log(`✅ Received ${data.jobs.length} job(s):\n`);
      data.jobs.forEach((job: any) => {
        const title = job.title.length > 60 ? job.title.substring(0, 60) + '...' : job.title;
        console.log(`   → ${title}`);
      });
    } else {
      console.log('ℹ️  No jobs available (queue empty)\n');
    }
    
    console.log('\n📋 Check server console for [WP Report] callback logs!\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
})();
