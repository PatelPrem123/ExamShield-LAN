const { Document, Packer, Paragraph, TextRun, ImageRun } = require('docx');
const fs = require('fs');
const path = require('path');

const sampleDir = path.join(__dirname, '..', 'sample-papers');
if (!fs.existsSync(sampleDir)) {
  fs.mkdirSync(sampleDir, { recursive: true });
}

// 1x1 transparent/colored PNG base64 for embedding as image
const samplePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJAD/6pnMgMAAAAAElFTkSuQmCC';
const sampleImageBuffer = Buffer.from(samplePngBase64, 'base64');

async function createPaper(filename, topic, questions) {
  const children = [
    new Paragraph({
      children: [
        new TextRun({ text: `Topic: ${topic}`, bold: true, size: 28 })
      ]
    }),
    new Paragraph({ text: '' })
  ];

  questions.forEach((q, idx) => {
    // Question title
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${idx + 1}. ${q.text}`, bold: true, size: 24 })
        ]
      })
    );

    // Optional image in question
    if (q.hasImage) {
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: sampleImageBuffer,
              transformation: { width: 100, height: 100 }
            })
          ]
        })
      );
    }

    // Options
    q.options.forEach((opt, optIdx) => {
      const letter = String.fromCharCode(65 + optIdx);
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${letter}. ${opt}`, size: 22 })
          ]
        })
      );
    });

    // Answer line
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Answer: ${q.answer}`, bold: true, size: 22 })
        ]
      })
    );

    // Explanation (MUST BE EXCLUDED BY PARSER)
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Explanation: Detailed technical explanation for question ${idx + 1} that must be ignored by ExamShield LAN.`, italics: true, size: 20 })
        ]
      })
    );

    children.push(new Paragraph({ text: '' }));
  });

  const doc = new Document({
    sections: [{ children }]
  });

  const buffer = await Packer.toBuffer(doc);
  const filePath = path.join(sampleDir, filename);
  fs.writeFileSync(filePath, buffer);
  console.log(`Generated: ${filePath} (${questions.length} questions)`);
}

async function main() {
  // 1. Hardware.docx (8 Questions)
  await createPaper('Hardware.docx', 'Hardware', [
    {
      text: 'Which motherboard form factor is the standard size commonly used in desktop tower systems?',
      options: ['Micro-ATX', 'ATX', 'Mini-ITX', 'Nano-ITX'],
      answer: 'B (single)'
    },
    {
      text: 'Which of the following are non-volatile storage technologies? (Refer to diagram below)',
      hasImage: true,
      options: ['NVMe Solid State Drive', 'DDR5 Synchronous DRAM', 'Magnetic Hard Disk Drive', 'SRAM CPU Cache'],
      answer: 'A, C (multiple)'
    },
    {
      text: 'A technician needs to replace a failed power supply. Which connector delivers power specifically to the CPU socket?',
      options: ['24-pin ATX', '4/8-pin EPS/ATX12V', '6-pin PCIe', 'SATA 15-pin'],
      answer: 'B (single)'
    },
    {
      text: 'Which RAID configuration provides disk striping with distributed parity requiring a minimum of three drives?',
      options: ['RAID 0', 'RAID 1', 'RAID 5', 'RAID 10'],
      answer: 'C (single)'
    },
    {
      text: 'Which display connection standards carry both uncompressed digital video and multi-channel audio?',
      options: ['DisplayPort', 'HDMI', 'VGA (DB-15)', 'DVI-A'],
      answer: 'A, B (multiple)'
    },
    {
      text: 'What type of expansion card is commonly installed into an M.2 2280 PCIe slot on modern desktop motherboards?',
      options: ['Sound Card', 'NVMe SSD', 'Ethernet NIC', 'Modem'],
      answer: 'B (single)'
    },
    {
      text: 'Which memory type uses ECC (Error-Correcting Code) and is primarily deployed in enterprise servers and workstations?',
      options: ['SODIMM', 'Registered ECC DDR4/DDR5', 'Unbuffered Non-ECC DDR4', 'LPDDR5'],
      answer: 'B (single)'
    },
    {
      text: 'Which components are critical to thermal dissipation between a CPU IHS and a heat sink cooler?',
      options: ['Thermal Paste', 'Cold Plate Heat Pipes', 'Thermal Pads', 'Copper Shims'],
      answer: 'A, B (multiple)'
    }
  ]);

  // 2. Networking.docx (8 Questions)
  await createPaper('Networking.docx', 'Networking', [
    {
      text: 'Which network protocol operates at the Transport layer (Layer 4) and provides reliable, connection-oriented data transfer?',
      options: ['UDP', 'IP', 'TCP', 'ICMP'],
      answer: 'C (single)'
    },
    {
      text: 'Which of the following IP addresses fall within private IPv4 address spaces as defined by RFC 1918?',
      options: ['10.15.2.1', '172.20.100.5', '192.169.1.1', '8.8.8.8'],
      answer: 'A, B (multiple)'
    },
    {
      text: 'What is the default port number used by HTTPS for secure web traffic encrypted with TLS?',
      options: ['80', '443', '8080', '22'],
      answer: 'B (single)'
    },
    {
      text: 'Which networking service automatically assigns IP addresses, subnet masks, and default gateways to client devices on a LAN?',
      options: ['DNS', 'DHCP', 'NAT', 'NTP'],
      answer: 'B (single)'
    },
    {
      text: 'Which wireless security standards utilize AES-CCMP encryption and 192-bit cryptographic algorithms?',
      options: ['WEP', 'WPA', 'WPA2-PSK', 'WPA3-Enterprise'],
      answer: 'C, D (multiple)'
    },
    {
      text: 'What is the maximum segment length of standard Cat6 unshielded twisted pair (UTP) cabling operating at 10 Gbps (10GBASE-T)?',
      options: ['100 meters', '55 meters', '30 meters', '15 meters'],
      answer: 'B (single)'
    },
    {
      text: 'Which network topology connects all nodes to a central forwarding device such as a switch or hub?',
      options: ['Ring Topology', 'Star Topology', 'Bus Topology', 'Mesh Topology'],
      answer: 'B (single)'
    },
    {
      text: 'Which commands can a technician run on a Windows command prompt to inspect network interface configurations and clear local DNS cache?',
      options: ['ipconfig /all', 'ipconfig /flushdns', 'ping -t', 'netstat -an'],
      answer: 'A, B (multiple)'
    }
  ]);

  // 3. Operating Systems.docx (8 Questions)
  await createPaper('Operating_Systems.docx', 'Operating Systems', [
    {
      text: 'Which Windows command-line utility scans the integrity of all protected system files and replaces corrupted files?',
      options: ['chkdsk /f', 'sfc /scannow', 'diskpart', 'gpupdate /force'],
      answer: 'B (single)'
    },
    {
      text: 'Which of the following file systems support native file-level compression and encryption permissions in modern Windows?',
      options: ['FAT32', 'exFAT', 'NTFS', 'ReFS'],
      answer: 'C, D (multiple)'
    },
    {
      text: 'Which Windows administrative console allows an engineer to configure Group Policies across local computer users?',
      options: ['gpedit.msc', 'compmgmt.msc', 'diskmgmt.msc', 'eventvwr.msc'],
      answer: 'A (single)'
    },
    {
      text: 'In Linux operating systems, which commands terminate a running process by its Process ID (PID)?',
      options: ['kill -9', 'pkill', 'killall', 'taskkill'],
      answer: 'A, B (multiple)'
    },
    {
      text: 'What Windows feature creates incremental point-in-time snapshots of system files and registry keys before software updates?',
      options: ['BitLocker', 'System Restore Points', 'File History', 'Storage Spaces'],
      answer: 'B (single)'
    },
    {
      text: 'Which macOS built-in backup utility automatically creates hourly, daily, and weekly backups to external storage drives?',
      options: ['Carbon Copy', 'Time Machine', 'Spotlight', 'Disk Utility'],
      answer: 'B (single)'
    },
    {
      text: 'Which key combination opens the Windows Task Manager directly without going through the GINA security screen?',
      options: ['Ctrl + Alt + Del', 'Ctrl + Shift + Esc', 'Alt + Tab', 'Win + X'],
      answer: 'B (single)'
    },
    {
      text: 'Which Windows boot configuration modes load only essential core drivers and services for troubleshooting?',
      options: ['Safe Mode', 'Safe Mode with Networking', 'Diagnostic Startup', 'Clean Boot'],
      answer: 'A, B (multiple)'
    }
  ]);

  // 4. Service Desk.docx (8 Questions)
  await createPaper('Service_Desk.docx', 'Service Desk', [
    {
      text: 'When troubleshooting a user issue, what is the FIRST step in the standard CompTIA troubleshooting methodology?',
      options: ['Establish a theory of probable cause', 'Identify the problem', 'Test the theory to determine cause', 'Establish a plan of action'],
      answer: 'B (single)'
    },
    {
      text: 'Which practices are considered best professional etiquette when communicating with an agitated end-user?',
      options: ['Maintain active listening and avoid interrupting', 'Argue technical specifics to prove fault', 'Document issue and provide clear follow-up timeframe', 'Use complex technical jargon to impress them'],
      answer: 'A, C (multiple)'
    },
    {
      text: 'What documentation file records all changes, approvals, and rollback plans made to production IT systems?',
      options: ['SLA Document', 'Change Management Request (RFC)', 'Knowledge Base Article', 'Incident Ticket'],
      answer: 'B (single)'
    },
    {
      text: 'Which security principle ensures that users receive only the minimum access rights necessary to perform their job duties?',
      options: ['Separation of Duties', 'Principle of Least Privilege', 'Implicit Deny', 'Zero Trust'],
      answer: 'B (single)'
    },
    {
      text: 'Which social engineering techniques attempt to manipulate employees into revealing credentials or confidential information?',
      options: ['Spear Phishing', 'Tailgating / Piggybacking', 'Vishing (Voice Phishing)', 'Shoulder Surfing'],
      answer: 'A, B (multiple)'
    },
    {
      text: 'Which document formally defines the expected uptime, response time, and penalties agreed upon between a service provider and client?',
      options: ['MOU', 'Service Level Agreement (SLA)', 'NDA', 'AUP'],
      answer: 'B (single)'
    },
    {
      text: 'What is the final step in the standard CompTIA troubleshooting methodology before closing a service desk ticket?',
      options: ['Verify full system functionality', 'Document findings, actions, and outcomes', 'Train the end user', 'Implement the solution'],
      answer: 'B (single)'
    },
    {
      text: 'Which safety guidelines should technicians follow when working inside power supplies (PSUs) or CRT displays?',
      options: ['Never open or repair internal capacitors', 'Always ground yourself with an ESD strap to the live mains', 'Discharge high-voltage capacitors safely', 'Replace individual electrolytic capacitors while plugged in'],
      answer: 'A, C (multiple)'
    }
  ]);

  console.log('All 32 sample questions (8 per topic) generated successfully!');
}

main().catch(console.error);
