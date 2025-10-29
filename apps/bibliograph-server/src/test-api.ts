import { AppService } from './app/app.service';
import { CreateLibraryItemDto, DeleteLibraryItemDto, UpdateMarkdownDto } from './app/dto';

async function testApi() {
  console.log('Testing LibraryItem API implementation...');
  
  const appService = new AppService();
  
  // Test 1: Create LibraryItem
  console.log('\n1. Testing createLibraryItem...');
  const createDto: CreateLibraryItemDto = {
    title: 'Test Book',
    authors: [
      { firstName: 'John', lastName: 'Doe' }
    ],
    abstract: 'This is a test book',
    publicationYear: 2023,
    publisher: 'Test Publisher',
    tags: ['test', 'book'],
    collections: ['collection1'],
    fileType: 'book'
  };
  
  try {
    const createdItem = await appService.createLibraryItem(createDto);
    console.log('✅ Successfully created LibraryItem:', createdItem.id);
    
    // Test 2: Get LibraryItem
    console.log('\n2. Testing getLibraryItem...');
    const retrievedItem = await appService.getLibraryItem(createdItem.id);
    console.log('✅ Successfully retrieved LibraryItem:', retrievedItem.title);
    
    // Test 3: Update Markdown
    console.log('\n3. Testing updateLibraryItemMarkdown...');
    const updateMarkdownDto: UpdateMarkdownDto = {
      id: createdItem.id,
      markdownContent: '# Test Book\n\nThis is the markdown content for the test book.'
    };
    
    const updateResult = await appService.updateLibraryItemMarkdown(updateMarkdownDto);
    console.log('✅ Successfully updated markdown:', updateResult.message);
    
    // Test 4: Delete LibraryItem
    console.log('\n4. Testing deleteLibraryItem...');
    const deleteDto: DeleteLibraryItemDto = {
      id: createdItem.id
    };
    
    const deleteResult = await appService.deleteLibraryItem(deleteDto);
    console.log('✅ Successfully deleted LibraryItem:', deleteResult.message);
    
    console.log('\n🎉 All tests passed! API implementation is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('This might be expected if Elasticsearch/S3 are not running.');
  }
}

testApi().catch(console.error);