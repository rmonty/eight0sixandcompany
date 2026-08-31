const admin = require('firebase-admin');

// Initialize Firebase Admin with the service account or default credentials
try {
  admin.initializeApp();
} catch {
  // Already initialized
}

async function addAuthorizedDomains() {
  try {
    const domainsToAdd = [
      'rmonty.github.io',
      'localhost',
      '127.0.0.1',
    ];

    console.log('Adding authorized domains to Firebase Authentication...');
    console.log('Domains:', domainsToAdd);

    // Get current settings
    await admin.projectManagement().getProjectConfig();
    console.log('\nCurrent settings retrieved.');

    // Update with new domains
    // Note: Firebase Admin SDK doesn't have direct authorized domains API
    // This needs to be done via REST API or console

    console.log('\n✓ To complete, visit:');
    console.log('https://console.firebase.google.com/project/eight0six-and-company/authentication/settings');
    console.log('\nThen add these domains in the "Authorized domains" section:');
    domainsToAdd.forEach(d => console.log(`  - ${d}`));

  } catch (error) {
    console.error('Error:', error.message);
  }
}

addAuthorizedDomains().then(() => process.exit(0));
